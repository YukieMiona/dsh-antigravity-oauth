import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { AGY_WORKSPACE_DIRNAME } from '../ids.ts'
import {
  AGY_MAX_INPUT_TOKENS,
  AGY_OVERHEAD_TOKENS,
  buildTemplateBody,
  estimateTokens,
  imageName,
  MESSAGE_BUDGET_TOKENS,
  parseAnswer,
  splitConversation,
  ToolCallFilter,
  WARM_TEMPLATE_BODY,
  warmMessage,
  type ImageBlock,
} from './prompt.ts'
import { AgyError, streamAgy, type AgyResult, type AgyUsage } from './run.ts'
import { noteAgyUse } from './quota-watch.ts'
import { ensureTemplate } from './template.ts'

export type AgyTurnEvent =
  | { type: 'text', text: string }
  | { type: 'done', text: string, calls: { name: string, arguments: string }[], rejected: string[], usage?: AgyUsage }

export interface AgyImage { mimeType: string, data: Uint8Array }
/** Bytes of an image that should reach the model, or the text that stands in for it. */
export type AgyImageLoader = (block: ImageBlock) => Promise<AgyImage | string>

export interface AgyTurnOptions {
  binary: string
  workspace: string
  /** Base model id; effort is separate. */
  model: string
  effort?: 'low' | 'medium' | 'high'
  request: Pick<GenerateOptions, 'messages' | 'system' | 'tools' | 'purpose'>
  signal?: AbortSignal
  onActivity?: () => void
  /** Without a loader every image becomes a placeholder. */
  loadImage?: AgyImageLoader
  queueTimeoutMs?: number
  maxUpstreamAttempts?: number
  /** See `AgyRunOptions.deadlineAt`. */
  deadlineAt?: number
  /** See `AgyRunOptions.interactive`. */
  interactive?: boolean
  /**
   * Send a request that fits one user message with a fixed template, so a started spare agy
   * process can take it (no start-up on the request path). Larger requests and images do not.
   */
  warm?: boolean
}

/**
 * Window DSH plans with on this route: agy's own input cap for gemini-3.8-flash, about 195K
 * tokens (see AGY_MAX_INPUT_TOKENS in prompt.ts). agy takes no output limit, so the output
 * reserve is only a planning number. DSH's basic compaction then starts at
 * min(0.8 × window, window − reserve − headroom); with its default 64K headroom that is about
 * 123K tokens. Older turns beyond what one request carries are dropped from the oldest end.
 */
export const AGY_CONTEXT_WINDOW_TOKENS = 196_608
export const AGY_RESERVED_OUTPUT_TOKENS = 8_192

export const AGY_MAX_IMAGES = 8
export const AGY_MAX_IMAGE_BYTES = 12 * 1024 * 1024
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}
const REQUESTS_DIRNAME = 'requests'
const STALE_REQUEST_MS = 60 * 60_000

/** Plugin-owned directory next to the auth file; agy runs in it and reads agent templates from it. */
export function agyWorkspace(authFilename: string): string {
  return join(dirname(authFilename), AGY_WORKSPACE_DIRNAME)
}

/** Remove request folders that a killed process left behind. */
async function pruneRequests(root: string): Promise<void> {
  const now = Date.now()
  for (const name of await readdir(root).catch(() => [] as string[])) {
    const dir = join(root, name)
    const info = await stat(dir).catch(() => undefined)
    if (info !== undefined && now - info.mtimeMs > STALE_REQUEST_MS) await rm(dir, { recursive: true, force: true }).catch(() => undefined)
  }
}

interface StagedImages {
  /** Folder of this request, or undefined when no image travels. */
  dir?: string
  text: Map<ImageBlock, string>
  /** Files of the images after the last assistant message: the model has to open each of them. */
  fresh: string[]
}

/**
 * agy takes text only on stdin, so an image travels as a file: it is written to a folder of this
 * request, the conversation names its absolute path, and agy's file viewer (confined to that
 * folder) opens it.
 */
async function stageImages(options: AgyTurnOptions): Promise<StagedImages> {
  const staged: StagedImages = { text: new Map(), fresh: [] }
  try {
    await stageInto(staged, options)
    return staged
  } catch (error) {
    // A rejected image must not leave the ones already written on disk.
    if (staged.dir !== undefined) await rm(staged.dir, { recursive: true, force: true }).catch(() => undefined)
    throw error
  }
}

async function stageInto(staged: StagedImages, options: AgyTurnOptions): Promise<void> {
  const messages = options.request.messages
  let lastAssistant = -1
  messages.forEach((message, index) => { if (message.role === 'assistant') lastAssistant = index })
  let count = 0
  for (const [index, message] of messages.entries()) {
    if (message.role !== 'user' && message.role !== 'tool') continue
    for (const block of message.content) {
      if (block.type !== 'image') continue
      const loaded = options.loadImage === undefined ? `[Image: ${imageName(block)} (not attached)]` : await options.loadImage(block)
      if (typeof loaded === 'string') { staged.text.set(block, loaded); continue }
      const extension = IMAGE_EXTENSIONS[loaded.mimeType.toLowerCase()]
      if (extension === undefined) throw new AgyError(`image type ${loaded.mimeType} is not supported (PNG, JPEG, WebP or GIF)`, 'image-rejected')
      if (loaded.data.byteLength === 0 || loaded.data.byteLength > AGY_MAX_IMAGE_BYTES) {
        throw new AgyError(`an image of ${loaded.data.byteLength} bytes cannot be sent (limit ${AGY_MAX_IMAGE_BYTES})`, 'image-rejected')
      }
      if (++count > AGY_MAX_IMAGES) throw new AgyError(`at most ${AGY_MAX_IMAGES} images fit in one request`, 'image-rejected')
      if (staged.dir === undefined) {
        const root = join(options.workspace, REQUESTS_DIRNAME)
        await pruneRequests(root)
        staged.dir = join(root, randomUUID())
        await mkdir(staged.dir, { recursive: true, mode: 0o700 })
      }
      const file = join(staged.dir, `image-${count}.${extension}`)
      await writeFile(file, loaded.data, { mode: 0o600 })
      staged.text.set(block, `[Image file: ${file}]`)
      if (index > lastAssistant) staged.fresh.push(file)
    }
  }
}

/** Share of the earlier-turn budget for each attempt after agy refused an input as too large. */
const TOO_LARGE_SHARES = [1, 0.6, 0.25] as const

/**
 * One model turn through the official CLI, shared by the DSH adapter and the local API server:
 * visible text as it streams, then one `done` event with the validated tool calls and usage.
 */
export async function* agyTurn(options: AgyTurnOptions): AsyncGenerator<AgyTurnEvent> {
  noteAgyUse(options.binary)
  const images = await stageImages(options)
  try {
    const withImages = images.dir !== undefined
    const cwd = images.dir ?? options.workspace
    const { body, tools } = buildTemplateBody(options.request, withImages)
    const bodyTokens = estimateTokens(body)
    const runOnce = (agent: string, recent: string, warm: boolean) => streamAgy({
      binary: options.binary,
      cwd,
      model: options.model,
      ...options.effort === undefined ? {} : { effort: options.effort },
      agent,
      // The files to open are named again at the end, where the model reads last.
      prompt: images.fresh.length === 0
        ? recent
        : `${recent}\n\n[Open these image files with view_file before you answer: ${images.fresh.join(', ')}]`,
      allowWorkspaceRead: withImages,
      ...options.signal === undefined ? {} : { signal: options.signal },
      ...options.onActivity === undefined ? {} : { onActivity: options.onActivity },
      ...options.queueTimeoutMs === undefined ? {} : { queueTimeoutMs: options.queueTimeoutMs },
      ...options.maxUpstreamAttempts === undefined ? {} : { maxUpstreamAttempts: options.maxUpstreamAttempts },
      ...options.deadlineAt === undefined ? {} : { deadlineAt: options.deadlineAt },
      ...options.interactive === true ? { interactive: true } : {},
      ...warm ? { warm: true } : {},
    })
    const filter = new ToolCallFilter()
    let streamed = ''
    let held = ''
    let result: AgyResult | undefined
    // agy refuses an input above its cap before the model runs. The estimate is conservative,
    // but if agy still refuses, older turns are dropped and the request is sent again.
    const imageText = (block: ImageBlock): string => images.text.get(block) ?? `[Image: ${imageName(block)} (not attached)]`
    const warm = options.warm === true && !withImages ? warmMessage(options.request.messages, body, imageText) : undefined
    // Attempt -1 is the warm run; if agy refuses it as too large, the usual path follows.
    for (let attempt = warm === undefined ? 0 : -1; ; attempt++) {
      if (attempt < 0) {
        const agent = await ensureTemplate(cwd, WARM_TEMPLATE_BODY)
        try {
          for await (const event of runOnce(agent, warm!, true)) {
            if (event.type === 'result') { result = event.result; break }
            const visible = filter.feed(event.text)
            if (visible.length === 0) continue
            streamed += visible
            yield { type: 'text', text: visible }
          }
          break
        } catch (error) {
          if (!(error instanceof AgyError && error.kind === 'too-large' && streamed.length === 0)) throw error
          console.warn('[dsh-antigravity-oauth] agy: warm request over the CLI\'s cap; sending it the usual way')
          continue
        }
      }
      const share = TOO_LARGE_SHARES[attempt]!
      const conversation = splitConversation(
        options.request.messages,
        MESSAGE_BUDGET_TOKENS,
        recentTokens => Math.max(0, Math.floor((AGY_MAX_INPUT_TOKENS - AGY_OVERHEAD_TOKENS - bodyTokens - recentTokens) * share)),
        imageText,
      )
      const agent = await ensureTemplate(cwd, conversation.earlier.length === 0
        ? body
        : `${body}\n\n# Earlier conversation (oldest first)\n\n${conversation.earlier}\n\n(End of the earlier conversation. The latest turns arrive in the user message.)`, withImages)
      try {
        for await (const event of runOnce(agent, conversation.recent, false)) {
          if (event.type === 'result') { result = event.result; break }
          const visible = filter.feed(event.text)
          if (visible.length === 0) continue
          // An answer about an image is held until agy confirms that it opened the image.
          if (images.fresh.length > 0) { held += visible; continue }
          streamed += visible
          yield { type: 'text', text: visible }
        }
        break
      } catch (error) {
        const retry = error instanceof AgyError && error.kind === 'too-large'
          && attempt + 1 < TOO_LARGE_SHARES.length && streamed.length === 0 && held.length === 0
        if (!retry) throw error
        console.warn(`[dsh-antigravity-oauth] agy: input over the CLI's cap; retrying with ${Math.round(TOO_LARGE_SHARES[attempt + 1]! * 100)}% of the earlier-turn budget`)
      }
    }
    const opened = new Set(result?.filesRead ?? [])
    const unread = images.fresh.filter(file => !opened.has(file))
    if (unread.length > 0) {
      throw new AgyError(
        `the model did not open ${unread.length} of ${images.fresh.length} attached image(s), so its answer was discarded`,
        'image-unread',
      )
    }
    const tail = held + filter.end()
    if (tail.length > 0) {
      streamed += tail
      yield { type: 'text', text: tail }
    }
    const parsed = parseAnswer(result?.response ?? streamed, new Set(tools.map(tool => tool.name)))
    // A result that arrived without streamed deltas still carries the full answer.
    if (streamed.length === 0 && parsed.text.length > 0) {
      streamed = parsed.text
      yield { type: 'text', text: parsed.text }
    }
    yield {
      type: 'done',
      text: streamed.trimEnd(),
      calls: parsed.calls,
      rejected: parsed.rejected,
      ...result?.usage === undefined ? {} : { usage: result.usage },
    }
  } finally {
    if (images.dir !== undefined) await rm(images.dir, { recursive: true, force: true }).catch(() => undefined)
  }
}
