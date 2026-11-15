import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import { AGY_WORKSPACE_DIRNAME } from '../ids.ts'
import {
  buildTemplateBody,
  CONVERSATION_BUDGET_BYTES,
  imageName,
  parseAnswer,
  splitConversation,
  TEMPLATE_BUDGET_BYTES,
  ToolCallFilter,
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
}

/**
 * Context window DSH should plan for on this route. One request carries about 620 KB (100 KB in
 * the user message plus a 520 KB template), so DSH has to compact before the model's own limit.
 */
export const AGY_CONTEXT_WINDOW_TOKENS = 131_072

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
    const conversation = splitConversation(
      options.request.messages,
      CONVERSATION_BUDGET_BYTES,
      Math.max(0, TEMPLATE_BUDGET_BYTES - Buffer.byteLength(body)),
      block => images.text.get(block) ?? `[Image: ${imageName(block)} (not attached)]`,
    )
    const agent = await ensureTemplate(cwd, conversation.earlier.length === 0
      ? body
      : `${body}\n\n# Earlier conversation (oldest first)\n\n${conversation.earlier}\n\n(End of the earlier conversation. The latest turns arrive in the user message.)`, withImages)
    const filter = new ToolCallFilter()
    let streamed = ''
    let held = ''
    let result: AgyResult | undefined
    for await (const event of streamAgy({
      binary: options.binary,
      cwd,
      model: options.model,
      ...options.effort === undefined ? {} : { effort: options.effort },
      agent,
      // The files to open are named again at the end, where the model reads last.
      prompt: images.fresh.length === 0
        ? conversation.recent
        : `${conversation.recent}\n\n[Open these image files with view_file before you answer: ${images.fresh.join(', ')}]`,
      allowWorkspaceRead: withImages,
      ...options.signal === undefined ? {} : { signal: options.signal },
      ...options.onActivity === undefined ? {} : { onActivity: options.onActivity },
      ...options.queueTimeoutMs === undefined ? {} : { queueTimeoutMs: options.queueTimeoutMs },
      ...options.maxUpstreamAttempts === undefined ? {} : { maxUpstreamAttempts: options.maxUpstreamAttempts },
    })) {
      if (event.type === 'result') { result = event.result; break }
      const visible = filter.feed(event.text)
      if (visible.length === 0) continue
      // An answer about an image is held until agy confirms that it opened the image.
      if (images.fresh.length > 0) { held += visible; continue }
      streamed += visible
      yield { type: 'text', text: visible }
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
