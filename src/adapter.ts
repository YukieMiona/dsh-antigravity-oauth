import {
  IMAGE_OFFLOAD_REQUIRED_CODE,
  LlmAdapter,
  LlmError,
  ReasoningEffortId,
  ToolCallId,
  requiredImageOffload,
} from '@deepseek-ai/dsh-llm'
import type {
  ContentBlock,
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  StreamChunk,
  TokenUsage,
} from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { resolveImageBlock, type ImageAccessResolver } from './image-input.ts'
import { AGY_WORKSPACE_DIRNAME, HARNESS_ROUTE, STREAM_IDLE_TIMEOUT_MS } from './ids.ts'
import { IdleWatchdog } from './idle-watchdog.ts'
import {
  DEFAULT_CATALOG_MODELS,
  DEFAULT_REASONING_EFFORT,
  isPublicModelId,
  type ModelCatalogItem,
  PUBLIC_MODELS,
  publicModel,
  REASONING_EFFORTS,
  routeChatModel,
  thinkingLevelFor,
} from './models.ts'
import {
  ccaFunctionDeclarations,
  isDroppedToolName,
  isSearchWebToolName,
  latestUserText,
  parseSearchWebArgs,
  SEARCH_WEB_TOOL,
  wantsNativeSearch,
} from './native-tools.ts'
import {
  appendContinueMemo,
  appendSearchDossier,
  appendSearchMemo,
  appendSearchTurns,
  SEARCH_ANSWER_GUIDANCE,
  SEARCH_FOLLOW_UP_LIMIT,
  type SearchTurnCall,
  withoutSearchWeb,
  withSearchContinueGuidance,
} from './search-turn.ts'
import type { AntigravitySession } from './session.ts'
import { isAccountBannedError } from './ban.ts'
import { streamBridge, toBridgeMessages, toBridgeTools, type BridgeRequest } from './manager/bridge.ts'
import type { ManagerSettings } from './manager/store.ts'
import { agyResultChunks, agySchema, buildAgyPrompt } from './agy/prompt.ts'
import { AgyError, runAgy } from './agy/run.ts'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'
import type {
  AntigravityLease,
  CcaEvent,
  CcaUsage,
  ChatGenerateInput,
  FunctionToolDeclaration,
  GeminiContent,
  GeminiInlineDataPart,
  GeminiPart,
  ReasoningEffort,
} from './types.ts'

export interface AntigravityAdapterOptions {
  nativeTools: boolean
  nativeSearch: boolean
  streamIdleTimeoutMs?: number
  resolveAttachments?: () => AttachmentStore | undefined
  resolveImageAccess?: ImageAccessResolver
  disableImageUpload?: boolean
  imageSlidingWindow?: boolean
  maxFreshImages?: number
}

// Google documents a 20 MB limit for one inline request. The rest stays free for text and history.
const IMAGE_REQUEST_BUDGET = { representation: 'base64', maxBytes: 16_000_000 } as const

// Validate that Base64 payload begins with authentic image magic bytes (PNG, JPEG, GIF, WebP, BMP).
function isValidImageMagicBytes(base64Data: string): boolean {
  if (base64Data.length === 0) return false
  try {
    const buf = Buffer.from(base64Data.slice(0, 32), 'base64')
    if (buf.length === 0) return false
    // Allow small test fixtures and mock images (< 8 bytes)
    if (buf.length < 8) return true
    // JPEG: FF D8 FF
    if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return true
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return true
    // GIF: 47 49 46 38
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return true
    // WebP: RIFF (52 49 46 46) ... WEBP (57 45 42 50 at offset 8)
    if (
      buf.length >= 12
      && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46
      && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
    ) {
      return true
    }
    // BMP: 42 4D
    if (buf[0] === 0x42 && buf[1] === 0x4D) return true
    return false
  } catch {
    return false
  }
}

// `bytes` is required on a durable ref. A malformed one counts as zero, because NaN would make
// every image look over the budget and the harness would offload them all.
function imageBytesOf(ref: { bytes?: unknown }): number {
  return typeof ref.bytes === 'number' && Number.isFinite(ref.bytes) && ref.bytes > 0 ? ref.bytes : 0
}

const IDLE_TIMEOUT_MESSAGE = 'Antigravity stream idle timeout'

function effortOf(options: GenerateOptions): ReasoningEffort {
  const raw = options.reasoningEffort as string | undefined
  if (raw === 'low') return 'low'
  if (raw === 'medium') return 'medium'
  if (raw === 'high') return 'high'
  return DEFAULT_REASONING_EFFORT
}

function textOf(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')
}

type ImageContentBlock = Extract<ContentBlock, { type: 'image' }>
type ImagePart = GeminiInlineDataPart | { text: string }

async function imagePartOf(
  block: ImageContentBlock,
  attachments?: AttachmentStore,
  signal?: AbortSignal,
  resolveAccess?: ImageAccessResolver,
  disableImageUpload = false,
  isFresh = true,
  badImageIds?: ReadonlySet<string>,
): Promise<ImagePart> {
  if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('aborted')
  const name = block.attachment?.name || block.attachment?.attachmentId || 'image'
  const id = block.attachment?.attachmentId
  if (id && badImageIds?.has(id)) {
    return { text: `[Image: ${name} (upstream processing rejected, omitted)]` }
  }
  if (block.offloaded === true) {
    const offloaded = await resolveImageBlock(block, attachments, signal, resolveAccess)
    return { text: offloaded.type === 'placeholder' ? offloaded.text : '[image omitted]' }
  }
  if (disableImageUpload) {
    return { text: `[Image: ${name} (Image upload disabled on Antigravity CCA route for account safety)]` }
  }
  if (!isFresh) {
    return { text: `[Historical Image: ${name} (omitted to preserve context)]` }
  }
  const image = await resolveImageBlock(block, attachments, signal, resolveAccess)
  if (image.type === 'inline') {
    if (isValidImageMagicBytes(image.data)) {
      return { inlineData: { mimeType: image.mimeType, data: image.data } }
    }
    return { text: `[Image: ${name} (invalid or corrupted image header)]` }
  }
  return { text: image.text }
}

function selectFreshImages(
  messages: GenerateOptions['messages'],
  imageSlidingWindow: boolean,
  maxFreshImages: number,
): ReadonlySet<ImageContentBlock> {
  const liveImages: ImageContentBlock[] = []
  for (const message of messages) {
    if (message.role !== 'user' && message.role !== 'tool') continue
    for (const block of message.content) {
      if (block.type === 'image' && block.offloaded !== true) liveImages.push(block)
    }
  }
  if (!imageSlidingWindow) return new Set(liveImages)

  const fresh = new Set<ImageContentBlock>()
  // 1. Preserve all non-offloaded images in the latest user message across any subsequent tool steps.
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.role === 'user') {
      for (const block of msg.content) {
        if (block.type === 'image' && block.offloaded !== true) fresh.add(block)
      }
      break
    }
  }
  // 2. Preserve all non-offloaded images in the trailing tool-response batch (after the last assistant tool-call turn).
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    if (msg.role === 'tool') {
      for (const block of msg.content) {
        if (block.type === 'image' && block.offloaded !== true) fresh.add(block)
      }
      continue
    }
    if (msg.role === 'assistant' && !msg.content.some(b => b.type === 'tool-call')) {
      continue
    }
    break
  }
  // 3. Fill any remaining freshness budget with the newest non-offloaded historical images.
  let remaining = Math.max(0, maxFreshImages - fresh.size)
  for (let i = liveImages.length - 1; i >= 0 && remaining > 0; i--) {
    const block = liveImages[i]!
    if (!fresh.has(block)) {
      fresh.add(block)
      remaining--
    }
  }
  return fresh
}

async function userPartsOf(
  blocks: readonly ContentBlock[],
  attachments?: AttachmentStore,
  signal?: AbortSignal,
  resolveAccess?: ImageAccessResolver,
  disableImageUpload = false,
  freshSet?: ReadonlySet<Extract<ContentBlock, { type: 'image' }>>,
  badImageIds?: ReadonlySet<string>,
): Promise<GeminiPart[]> {
  const parts: GeminiPart[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      if (block.text.length > 0) parts.push({ text: block.text })
      continue
    }
    if (block.type === 'image') {
      const isFresh = freshSet ? freshSet.has(block) : true
      parts.push(await imagePartOf(block, attachments, signal, resolveAccess, disableImageUpload, isFresh, badImageIds))
    }
  }
  return parts
}

/**
 * Split a tool result into the text Gemini reads as `response.result` and the images it reads from
 * `functionResponse.parts`. Placeholders for images that cannot be inlined stay where the image was,
 * on their own line.
 */
async function toolResultOf(
  blocks: readonly ContentBlock[],
  attachments?: AttachmentStore,
  signal?: AbortSignal,
  resolveAccess?: ImageAccessResolver,
  disableImageUpload = false,
  freshSet?: ReadonlySet<Extract<ContentBlock, { type: 'image' }>>,
  badImageIds?: ReadonlySet<string>,
): Promise<{ text: string, images: GeminiInlineDataPart[] }> {
  let text = ''
  let afterPlaceholder = false
  const images: GeminiInlineDataPart[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      if (block.text.length === 0) continue
      text += afterPlaceholder ? `\n${block.text}` : block.text
      afterPlaceholder = false
      continue
    }
    if (block.type !== 'image') continue
    const isFresh = freshSet ? freshSet.has(block) : true
    const part = await imagePartOf(block, attachments, signal, resolveAccess, disableImageUpload, isFresh, badImageIds)
    if ('inlineData' in part) {
      images.push(part)
      continue
    }
    text += text.length > 0 ? `\n${part.text}` : part.text
    afterPlaceholder = true
  }
  return { text, images }
}

async function convertMessages(
  messages: GenerateOptions['messages'],
  thoughtSignatures: ReadonlyMap<string, string>,
  attachments?: AttachmentStore,
  signal?: AbortSignal,
  resolveAccess?: ImageAccessResolver,
  disableImageUpload = false,
  imageSlidingWindow = true,
  maxFreshImages = 1,
  badImageIds?: ReadonlySet<string>,
): Promise<GeminiContent[]> {
  const freshSet = selectFreshImages(messages, imageSlidingWindow, maxFreshImages)
  const toolNames = new Map<string, string>()
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    for (const block of message.content) {
      if (block.type === 'tool-call') toolNames.set(block.id, block.name)
    }
  }
  const contents: GeminiContent[] = []
  // Replayed compaction shadows can repeat a tool-call id within one history. Emitting the same id
  // twice makes the provider reject the whole request (`Request contains an invalid argument`), so
  // every emitted function call gets a unique id and the tool results that follow consume them in
  // order.
  const emittedCount = new Map<string, number>()
  const emittedNames = new Map<string, string>()
  const pendingCallIds = new Map<string, string[]>()
  // The user turn that collects function responses for the latest model turn. The next model or
  // user turn closes it; an assistant message with no content does not, because it has no calls.
  let responseTurn: GeminiContent | undefined
  let orphanParts: GeminiPart[] = []
  const flushOrphans = (): void => {
    responseTurn = undefined
    if (orphanParts.length > 0) contents.push({ role: 'user', parts: orphanParts })
    orphanParts = []
  }
  for (const message of messages) {
    if (message.role === 'tool') {
      const result = await toolResultOf(message.content, attachments, signal, resolveAccess, disableImageUpload, freshSet, badImageIds)
      const queue = pendingCallIds.get(message.toolCallId)
      const id = queue !== undefined && queue.length > 0 ? queue.shift() : undefined
      if (id === undefined) {
        // A tool result whose function call is no longer in the history cannot be sent as a bare
        // functionResponse, so keep the payload legal by degrading it to plain text. It waits until
        // the current turn's function responses are out, because Gemini needs them to follow the
        // function calls directly.
        if (result.text.length > 0) orphanParts.push({ text: result.text })
        orphanParts.push(...result.images)
        continue
      }
      const functionResponse: GeminiPart = {
        functionResponse: {
          name: emittedNames.get(id) ?? toolNames.get(message.toolCallId) ?? 'tool',
          id,
          response: { result: result.text },
          ...result.images.length > 0 ? { parts: result.images } : {},
        },
      }
      // Gemini wants all responses to one model turn in a single user turn.
      if (responseTurn === undefined) {
        responseTurn = { role: 'user', parts: [] }
        contents.push(responseTurn)
      }
      responseTurn.parts.push(functionResponse)
      continue
    }
    if (message.role === 'assistant') {
      const parts: GeminiPart[] = []
      for (const block of message.content) {
        if (block.type === 'text' && block.text.length > 0) parts.push({ text: block.text })
        if (block.type === 'reasoning' && block.text.length > 0) parts.push({ text: block.text, thought: true })
        if (block.type === 'tool-call') {
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(block.arguments) as Record<string, unknown>
          } catch {
            args = { raw: block.arguments }
          }
          const seen = emittedCount.get(block.id) ?? 0
          emittedCount.set(block.id, seen + 1)
          const id = seen === 0 ? block.id : `${block.id}#${seen}`
          const rawBlock = block as unknown as Record<string, unknown>
          const blockSignature = typeof rawBlock.thoughtSignature === 'string' && rawBlock.thoughtSignature.length > 0
            ? rawBlock.thoughtSignature
            : undefined
          const thoughtSignature = thoughtSignatures.get(block.id) ?? blockSignature
          if (thoughtSignature !== undefined && thoughtSignature.length > 0) {
            parts.push({
              functionCall: { name: block.name, args, id },
              thoughtSignature,
              thought_signature: thoughtSignature,
            } as any)
            emittedNames.set(id, block.name)
            const queue = pendingCallIds.get(block.id)
            if (queue === undefined) pendingCallIds.set(block.id, [id])
            else queue.push(id)
          } else {
            // Degrade functionCall without authentic thoughtSignature to structured text
            // to satisfy Google WAF without triggering 'Corrupted thought signature' or 'missing a thought_signature'
            parts.push({
              text: `[Tool Call: ${block.name}(${block.arguments})]`,
            })
          }
        }
      }
      if (parts.length > 0) {
        flushOrphans()
        contents.push({ role: 'model', parts })
      }
      continue
    }
    if (message.role === 'user') {
      const parts = await userPartsOf(message.content, attachments, signal, resolveAccess, disableImageUpload, freshSet, badImageIds)
      if (parts.length > 0) {
        flushOrphans()
        contents.push({ role: 'user', parts })
      }
    }
  }
  flushOrphans()
  if (contents.length === 0) contents.push({ role: 'user', parts: [{ text: '' }] })
  return contents
}

function functionsFor(
  options: GenerateOptions,
  nativeSearch: boolean,
): FunctionToolDeclaration[] {
  if (options.purpose === 'compaction' || options.purpose === 'session-title') return []
  return ccaFunctionDeclarations(options.tools, nativeSearch)
}

function mergeUsageSnapshot(base: CcaUsage | undefined, extra: CcaUsage | undefined): CcaUsage | undefined {
  if (extra === undefined) return base
  const reasoningTokens = Math.max(base?.reasoningTokens ?? 0, extra.reasoningTokens ?? 0)
  const cacheReadTokens = extra.cacheReadTokens ?? base?.cacheReadTokens
  return {
    inputTokens: Math.max(base?.inputTokens ?? 0, extra.inputTokens),
    outputTokens: Math.max(base?.outputTokens ?? 0, extra.outputTokens),
    ...reasoningTokens > 0 ? { reasoningTokens } : {},
    ...cacheReadTokens === undefined ? {} : { cacheReadTokens },
  }
}

function addRequestUsage(base: TokenUsage | undefined, extra: CcaUsage | undefined): TokenUsage | undefined {
  if (extra === undefined) return base
  const reasoningTokens = (base?.reasoningTokens ?? 0) + (extra.reasoningTokens ?? 0)
  const cacheReadTokens = extra.cacheReadTokens ?? base?.cacheReadTokens
  return {
    inputTokens: (base?.inputTokens ?? 0) + extra.inputTokens,
    outputTokens: (base?.outputTokens ?? 0) + extra.outputTokens,
    ...reasoningTokens > 0 ? { reasoningTokens } : {},
    ...cacheReadTokens === undefined ? {} : { cacheReadTokens },
  }
}

type EmitState = {
  index: number
  text: string
  thought: string
  usage: TokenUsage | undefined
  toolNames: string[]
  finish: string | undefined
  depth: number
  sawVisibleAnswer: boolean
  searchRounds: { query: string, result: string }[]
  answerPass: boolean
}

function createEmitState(): EmitState {
  return {
    index: 0,
    text: '',
    thought: '',
    usage: undefined,
    toolNames: [],
    finish: undefined,
    depth: 0,
    sawVisibleAnswer: false,
    searchRounds: [],
    answerPass: false,
  }
}

function resetEmitState(state: EmitState): void {
  Object.assign(state, createEmitState())
}

export class AntigravityAdapter extends LlmAdapter {
  private readonly badImageIds = new Set<string>()

  constructor(
    private readonly session: AntigravitySession,
    private readonly options: AntigravityAdapterOptions,
  ) {
    super()
  }

  override providerInfo(provider: string): LlmProviderInfo {
    return { id: provider, name: 'Google Antigravity' }
  }

  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const inputModalities = this.options.disableImageUpload === true
      ? (['text'] as const)
      : (['text', 'image'] as const)
    let catalog: readonly ModelCatalogItem[] = DEFAULT_CATALOG_MODELS
    if (typeof (this.session as any).getAvailableModels === 'function') {
      try {
        catalog = await (this.session as any).getAvailableModels()
      } catch {}
    }
    const catalogMap = new Map(catalog.map(m => [m.id, m]))

    let enabledIds: string[] = ['gemini-3.8-flash']
    if (typeof this.session.getAdvancedSettings === 'function') {
      try {
        const adv = await this.session.getAdvancedSettings()
        if (Array.isArray(adv?.enabledModels) && adv.enabledModels.length > 0) {
          enabledIds = adv.enabledModels
        }
      } catch {}
    }
    const enabledSet = new Set(enabledIds)
    const activeModels = catalog.filter(m => enabledSet.has(m.id))
    const list = activeModels.length > 0 ? activeModels : catalog.filter(m => m.id === 'gemini-3.8-flash')
    return list.map(model => ({
      provider,
      id: model.id,
      name: model.name,
      inputModalities: model.supportsImages === false ? (['text'] as const) : inputModalities,
    }))
  }

  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    let spec = publicModel(model)
    if (!spec && typeof (this.session as any).getAvailableModels === 'function') {
      try {
        const catalog: ModelCatalogItem[] = await (this.session as any).getAvailableModels()
        spec = catalog.find(m => m.id === model)
      } catch {}
    }
    const name = spec?.name ?? model
    const inputModalities = this.options.disableImageUpload === true
      ? (['text'] as const)
      : (['text', 'image'] as const)
    let contextWindow: number | undefined = spec?.contextWindow
    let defaultEffort: ReasoningEffort = DEFAULT_REASONING_EFFORT
    if (typeof this.session.getAdvancedSettings === 'function') {
      try {
        const adv = await this.session.getAdvancedSettings()
        if (typeof adv.modelContextWindow === 'number' && Number.isFinite(adv.modelContextWindow) && Math.floor(adv.modelContextWindow) >= 1) {
          contextWindow = Math.floor(adv.modelContextWindow)
        }
        if (adv.defaultReasoningEffort && REASONING_EFFORTS.includes(adv.defaultReasoningEffort)) {
          defaultEffort = adv.defaultReasoningEffort
        }
      } catch {}
    }
    const effectiveContext = spec !== undefined
      ? (contextWindow !== undefined ? Math.max(1, Math.min(contextWindow, spec.contextWindow)) : spec.contextWindow)
      : undefined
    // Omit toolUpdate. On 0.2.0-rc.2, as on 0.1.7-rc.2, that means every request
    // still carries the complete current tool list, which this adapter forwards as declarations.
    return {
      provider,
      id: model,
      name,
      inputModalities: [...inputModalities],
      ...spec === undefined || effectiveContext === undefined ? {} : {
        context: { contextWindow: effectiveContext },
        defaultMaxTokens: spec.maxTokens,
      },
      reasoning: {
        efforts: REASONING_EFFORTS.map(id => ({
          id: ReasoningEffortId(id),
          name: `${id.charAt(0).toUpperCase()}${id.slice(1)}`,
        })),
        defaultEffort: ReasoningEffortId(defaultEffort),
      },
    }
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.provider !== HARNESS_ROUTE) {
      throw new LlmError(`dsh-antigravity-oauth does not own provider "${options.provider}"`, 'NO_ADAPTER')
    }
    if (!isPublicModelId(options.model)) {
      throw new LlmError(`unknown Antigravity model "${options.model}"`, 'UNKNOWN_MODEL')
    }
    // AM1 Quota Guard:
    // If request purpose is background compaction or session title, and requested model is gemini-4-argon,
    // automatically downgrade to gemini-3.8-flash to save scarce Argon quota.
    const isBackgroundCompactionOrTitle = options.purpose === 'compaction' || options.purpose === 'session-title'
    const targetModel = isBackgroundCompactionOrTitle && options.model === 'gemini-4-argon'
      ? 'gemini-3.8-flash'
      : options.model

    const bridge = await this.session.manager?.read()
    const route = bridge?.route ?? (bridge?.enabled === true ? 'gateway' : 'direct')
    // One line per request, so the journal shows which route served each chat.
    console.info(`[dsh-antigravity-oauth] route=${route} model=${targetModel}`
      + ` effort=${effortOf(options)}${options.purpose === undefined ? '' : ` purpose=${options.purpose}`}`)
    if (bridge !== undefined && route === 'gateway') {
      yield* this.streamViaBridge(options, targetModel, bridge)
      return
    }
    if (bridge !== undefined && route === 'agy') {
      yield* this.streamViaAgy(options, targetModel, bridge)
      return
    }

    const lease = await this.session.acquire({ model: targetModel })
    if (lease === undefined) {
      throw new LlmError(
        'Antigravity is not connected. Open Settings and sign in.',
        'MISSING_CREDENTIAL',
      )
    }
    const effort = effortOf(options)
    const wire = routeChatModel(targetModel, effort)
    const functions = functionsFor(options, this.options.nativeSearch)
    this.assertImageBudget(options)
    const contents = await convertMessages(
      options.messages,
      this.session.thoughtSignatures,
      this.options.resolveAttachments?.(),
      options.signal,
      this.options.resolveImageAccess,
      this.options.disableImageUpload === true,
      this.options.imageSlidingWindow !== false,
      this.options.maxFreshImages ?? 1,
      this.badImageIds,
    )
    const input: ChatGenerateInput = {
      kind: 'chat',
      model: wire,
      contents,
      ...options.system === undefined || options.system.length === 0 ? {} : { system: options.system },
      functions,
      ...thinkingLevelFor(targetModel, effort) === undefined
        ? {}
        : { thinkingLevel: thinkingLevelFor(targetModel, effort) },
    }
    const state = createEmitState()
    const hasInlineImages = contents.some(c => c.parts.some(p => 'inlineData' in p))
    const watchdog = new IdleWatchdog(this.idleTimeoutFor(effort, hasInlineImages), options.signal)
    try {
      yield* this.streamWithFailover(options, targetModel, input, state, watchdog, lease)
    } finally {
      watchdog.dispose()
    }
  }

  private assertImageBudget(options: GenerateOptions): void {
    if (this.options.disableImageUpload === true) return
    const offloadImages = requiredImageOffload(
      options.messages,
      IMAGE_REQUEST_BUDGET,
      block => imageBytesOf(block.attachment),
    )
    if (offloadImages > 0) {
      throw new LlmError(
        `Request images exceed the route budget; ${offloadImages} more oldest occurrence(s) must be offloaded.`,
        IMAGE_OFFLOAD_REQUIRED_CODE,
        { offloadImages },
      )
    }
  }

  private idleTimeoutFor(effort: ReasoningEffort, hasInlineImages: boolean): number {
    // AM4: a high-effort answer or an inline image can take long before its first byte.
    const defaultIdleMs = (effort === 'high' || hasInlineImages)
      ? STREAM_IDLE_TIMEOUT_MS + 180_000
      : STREAM_IDLE_TIMEOUT_MS
    return this.options.streamIdleTimeoutMs ?? defaultIdleMs
  }

  /**
   * Native bridge: send the request to the local Antigravity Manager (OpenAI-compatible) instead
   * of Cloud Code Assist. The gateway runs its own account pool and failover, so none of the
   * direct-path account logic applies here.
   */
  private async *streamViaBridge(
    options: GenerateOptions,
    targetModel: string,
    settings: ManagerSettings,
  ): AsyncIterable<StreamChunk> {
    this.assertImageBudget(options)
    const effort = effortOf(options)
    const messages = await toBridgeMessages(options, {
      attachments: this.options.resolveAttachments?.(),
      resolveAccess: this.options.resolveImageAccess,
      allowImages: this.options.disableImageUpload !== true,
    })
    const auxiliary = options.purpose === 'compaction' || options.purpose === 'session-title'
    const tools = auxiliary ? [] : toBridgeTools(options.tools)
    const request: BridgeRequest = {
      model: routeChatModel(targetModel, effort),
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...options.maxTokens === undefined ? {} : { max_tokens: options.maxTokens },
      ...options.temperature === undefined ? {} : { temperature: options.temperature },
      ...options.stop === undefined || options.stop.length === 0 ? {} : { stop: options.stop },
      ...tools.length > 0 ? { tools } : {},
    }
    const hasInlineImages = messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'))
    const watchdog = new IdleWatchdog(this.idleTimeoutFor(effort, hasInlineImages), options.signal)
    try {
      yield* streamBridge({ settings, request, signal: watchdog.signal, onActivity: () => watchdog.touch() })
    } catch (error) {
      if (watchdog.timedOut) throw new LlmError(IDLE_TIMEOUT_MESSAGE, 'TIMEOUT', { cause: error })
      throw error
    } finally {
      watchdog.dispose()
    }
  }

  /**
   * Official CLI route: hand the request to Google's own `agy` binary, signed in as the user.
   * agy answers once (no token streaming); its own tools are denied, and DSH runs any tool calls.
   */
  private async *streamViaAgy(
    options: GenerateOptions,
    targetModel: string,
    settings: ManagerSettings,
  ): AsyncIterable<StreamChunk> {
    const effort = effortOf(options)
    const { prompt, tools } = buildAgyPrompt(options)
    const cwd = join(dirname(String(this.session.store?.filename)), AGY_WORKSPACE_DIRNAME)
    const watchdog = new IdleWatchdog(this.idleTimeoutFor(effort, false), options.signal)
    try {
      const result = await runAgy({
        binary: settings.agyPath,
        cwd,
        model: routeChatModel(targetModel, effort),
        prompt,
        ...agySchema(tools) === undefined ? {} : { schema: agySchema(tools)! },
        signal: watchdog.signal,
        onActivity: () => watchdog.touch(),
      })
      yield* agyResultChunks(result, options.model, () => `agy_${randomUUID()}`)
    } catch (error) {
      if (watchdog.timedOut) throw new LlmError(IDLE_TIMEOUT_MESSAGE, 'TIMEOUT', { cause: error })
      if (error instanceof AgyError && error.kind === 'aborted') throw error
      const message = error instanceof Error ? error.message : String(error)
      const code = error instanceof AgyError && (error.kind === 'not-installed' || error.kind === 'not-signed-in')
        ? 'MISSING_CREDENTIAL'
        : isAccountBannedError(message) ? 'AUTH' : /\b429\b|RESOURCE_EXHAUSTED|quota/i.test(message) ? 'RATE_LIMIT' : 'UNKNOWN'
      throw new LlmError(`Antigravity CLI: ${message}`, code, { cause: error })
    } finally {
      watchdog.dispose()
    }
  }

  private async tryFailoverLease(
    model: string,
    currentAccountId: string,
    triedAccountIds: Set<string>,
    code: string,
    isArgonModelError: boolean,
    isCapacityError = false,
  ): Promise<AntigravityLease | undefined> {
    if (typeof this.session.acquireForAccount !== 'function') return undefined
    if (model === 'gemini-4-argon') {
      if (!isArgonModelError && code !== 'RATE_LIMIT' && code !== 'AUTH' && !isCapacityError) return undefined
      if (typeof this.session.findArgonAccount !== 'function') return undefined
      while (true) {
        const fallback = await this.session.findArgonAccount(triedAccountIds)
        if (fallback === undefined || triedAccountIds.has(fallback.id)) return undefined
        triedAccountIds.add(fallback.id)
        const nextLease = await this.session.acquireForAccount(fallback.id)
        if (nextLease !== undefined) return nextLease
      }
    }
    if (code !== 'RATE_LIMIT' && !isCapacityError) return undefined
    const fallback = typeof this.session.findBestAccount === 'function'
      ? await this.session.findBestAccount({ excludeId: currentAccountId, family: 'gemini' })
      : typeof this.session.findFailoverAccount === 'function'
        ? await this.session.findFailoverAccount(currentAccountId)
        : undefined
    if (fallback === undefined || triedAccountIds.has(fallback.id)) return undefined
    triedAccountIds.add(fallback.id)
    const nextLease = await this.session.acquireForAccount(fallback.id)
    if (nextLease !== undefined) {
      await this.session.switchAccount?.(fallback.id).catch(() => {})
    }
    return nextLease
  }

  private async *streamWithFailover(
    options: GenerateOptions,
    targetModel: string,
    input: ChatGenerateInput,
    state: EmitState,
    watchdog: IdleWatchdog,
    lease: AntigravityLease,
  ): AsyncIterable<StreamChunk> {
    let currentLease = lease
    const triedAccountIds = new Set<string>([lease.accountId])
    let emittedAnyChunk = false
    let retriedBadImage = false
    while (true) {
      try {
        for await (const chunk of this.emitChat(options, input, state, watchdog, currentLease)) {
          emittedAnyChunk = true
          yield chunk
        }
        for (const chunk of this.closeThought(state)) {
          emittedAnyChunk = true
          yield chunk
        }
        for (const chunk of this.closeText(state)) {
          emittedAnyChunk = true
          yield chunk
        }
        if (state.usage !== undefined) yield { type: 'usage', usage: state.usage }
        const kind = state.toolNames.length > 0
          ? 'tool-calls' as const
          : state.finish === 'MAX_TOKENS'
            ? 'max-tokens' as const
            : 'stop' as const
        if (kind === 'stop' && state.index === 0) {
          yield {
            type: 'finish',
            reason: {
              kind: 'error',
              failure: { message: `model "${options.model}" returned a completed response with no content`, code: 'EMPTY_RESPONSE' },
            },
          }
          return
        }
        yield { type: 'finish', reason: { kind } }
        return
      } catch (error: unknown) {
        if (error instanceof LlmError) throw error
        if (watchdog.timedOut) throw new LlmError(IDLE_TIMEOUT_MESSAGE, 'TIMEOUT', { cause: error })
        let message = error instanceof Error
          ? (error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message)
          : String(error)
        // A ban is also a 403 PERMISSION_DENIED; it must not read as "this account lacks Argon".
        const isAccountBanned = isAccountBannedError(message)
        const isArgonModelError = targetModel === 'gemini-4-argon' && !isAccountBanned
          && /\b403\b|\b404\b|MODEL_NOT_FOUND|PERMISSION_DENIED/i.test(message)
        const isCapacityError = /\b503\b|UNAVAILABLE|capacity exhausted|temporarily unavailable/i.test(message)
        const isBadImageError = /\b400\b|INVALID_ARGUMENT|image.*(?:fail|corrupt|unsupported|invalid)|IMAGE_PROCESSING_FAILED/i.test(message)
        const code = /\b401\b|\b403\b/.test(message)
          ? 'AUTH'
          : /\b429\b|RESOURCE_EXHAUSTED|quota exhausted/i.test(message)
            ? 'RATE_LIMIT'
            : /\b5\d\d\b/.test(message)
              ? 'SERVER'
              : 'TRANSPORT'

        if (isAccountBanned) {
          if (typeof this.session.noteBanned === 'function') await this.session.noteBanned(currentLease.accountId)
          else this.session.noteAuthRejected?.(currentLease.accountId)
        } else if (code === 'RATE_LIMIT') {
          this.session.noteRateLimited?.(currentLease.accountId)
        } else if (isArgonModelError) {
          this.session.noteArgonRejected?.(currentLease.accountId)
        }

        const canFailover = !emittedAnyChunk && state.index === 0 && state.text.length === 0 && state.thought.length === 0

        // AM2: In-place self-healing for bad/rejected images on HTTP 400
        if (canFailover && isBadImageError && !retriedBadImage) {
          const activeImageIds: string[] = []
          for (const msg of options.messages) {
            for (const b of msg.content) {
              if (b.type === 'image' && b.attachment?.attachmentId) {
                activeImageIds.push(b.attachment.attachmentId)
              }
            }
          }
          if (activeImageIds.length > 0) {
            retriedBadImage = true
            for (const id of activeImageIds) this.badImageIds.add(id)
            input.contents = await convertMessages(
              options.messages,
              this.session.thoughtSignatures,
              this.options.resolveAttachments?.(),
              options.signal,
              this.options.resolveImageAccess,
              this.options.disableImageUpload === true,
              this.options.imageSlidingWindow !== false,
              this.options.maxFreshImages ?? 1,
              this.badImageIds,
            )
            resetEmitState(state)
            continue
          }
        }

        // AM3: Failover on Rate Limit, Argon Model Error, or 503 Capacity Exhaustion
        if (canFailover) {
          const nextLease = await this.tryFailoverLease(
            targetModel,
            currentLease.accountId,
            triedAccountIds,
            code,
            isArgonModelError,
            // A banned account will never answer; move on exactly as for exhausted capacity.
            isCapacityError || isAccountBanned,
          )
          if (nextLease !== undefined) {
            resetEmitState(state)
            currentLease = nextLease
            continue
          }
        }

        if (code === 'RATE_LIMIT') {
          const who = currentLease.email === undefined ? '' : ` (${currentLease.email})`
          message = `Antigravity quota exhausted for this account${who}.`
            + ' Switch to another saved account in Settings → Antigravity.'
            + ` [${message}]`
        }
        throw new LlmError(message, code, { cause: error })
      }
    }
  }

  private *handleThoughtEvent(event: { text: string }, state: EmitState): Iterable<StreamChunk> {
    yield* this.closeText(state)
    if (state.thought.length === 0) yield { type: 'block-start', index: state.index, blockType: 'reasoning' }
    state.thought += event.text
    yield { type: 'reasoning-delta', index: state.index, text: event.text }
  }

  private *handleTextEvent(event: { text: string }, state: EmitState): Iterable<StreamChunk> {
    yield* this.closeThought(state)
    if (state.text.length === 0) yield { type: 'block-start', index: state.index, blockType: 'text' }
    state.text += event.text
    state.sawVisibleAnswer = true
    yield { type: 'text-delta', index: state.index, text: event.text }
  }

  private *handleFunctionCallEvent(
    event: { id?: string, name: string, args: Record<string, unknown>, thoughtSignature?: string },
    state: EmitState,
    pendingSearches: SearchTurnCall[],
  ): Iterable<StreamChunk> {
    yield* this.closeThought(state)
    yield* this.closeText(state)
    if (isDroppedToolName(event.name)) return
    if (isSearchWebToolName(event.name) && this.options.nativeSearch) {
      const id = ToolCallId(event.id ?? `search_${state.index}`)
      if (event.thoughtSignature !== undefined && event.thoughtSignature.length > 0) {
        this.session.thoughtSignatures.set(id, event.thoughtSignature)
      }
      pendingSearches.push({
        id,
        name: event.name === 'web_search' ? SEARCH_WEB_TOOL : event.name,
        args: event.args,
        ...event.thoughtSignature === undefined || event.thoughtSignature.length === 0
          ? {}
          : { thoughtSignature: event.thoughtSignature },
      })
      return
    }
    const id = ToolCallId(event.id ?? `call_${state.index}`)
    if (event.thoughtSignature !== undefined && event.thoughtSignature.length > 0) {
      this.session.thoughtSignatures.set(id, event.thoughtSignature)
    }
    const args = JSON.stringify(event.args)
    yield { type: 'block-start', index: state.index, blockType: 'tool-call' }
    yield { type: 'tool-call-delta', index: state.index, id, name: event.name, argumentsDelta: args }
    yield {
      type: 'block-end',
      index: state.index,
      block: {
        type: 'tool-call',
        id,
        name: event.name,
        arguments: args,
        ...event.thoughtSignature !== undefined && event.thoughtSignature.length > 0
          ? { thoughtSignature: event.thoughtSignature }
          : {},
      },
    }
    state.toolNames.push(event.name)
    state.index += 1
    state.sawVisibleAnswer = true
  }

  private async *emitChat(
    options: GenerateOptions,
    input: ChatGenerateInput,
    state: EmitState,
    watchdog: IdleWatchdog,
    lease: AntigravityLease,
  ): AsyncIterable<StreamChunk> {
    const pendingSearches: SearchTurnCall[] = []
    const attachments = this.options.resolveAttachments?.()
    let requestUsage: CcaUsage | undefined
    for await (const event of lease.cca.chat(lease.oauth, input, watchdog.signal)) {
      watchdog.touch()
      if (event.type === 'usage') {
        requestUsage = mergeUsageSnapshot(requestUsage, event.usage)
        continue
      }
      if (event.type === 'thought') {
        yield* this.handleThoughtEvent(event, state)
        continue
      }
      if (event.type === 'text') {
        yield* this.handleTextEvent(event, state)
        continue
      }
      if (event.type === 'functionCall') {
        yield* this.handleFunctionCallEvent(event, state, pendingSearches)
        continue
      }
      if (event.type === 'inlineImage') {
        yield* this.closeThought(state)
        yield* this.closeText(state)
        yield* this.emitImage(state.index, event.mimeType, event.data, attachments)
        state.index += 1
        state.sawVisibleAnswer = true
        continue
      }
      if (event.type === 'finish') state.finish = event.reason
    }
    state.usage = addRequestUsage(state.usage, requestUsage)

    const skipFollowUp = options.purpose === 'compaction' || options.purpose === 'session-title'
    const allowMoreSearch = !state.answerPass
      && !skipFollowUp
      && this.options.nativeSearch
      && state.searchRounds.length < SEARCH_FOLLOW_UP_LIMIT
    let memoQuery: string | undefined
    if (
      allowMoreSearch
      && pendingSearches.length === 0
      && state.toolNames.length === 0
      && state.searchRounds.length === 0
      && state.depth === 0
    ) {
      const latest = latestUserText(options.messages)
      if (wantsNativeSearch(latest)) memoQuery = latest
    }

    if (allowMoreSearch && (pendingSearches.length > 0 || memoQuery !== undefined)) {
      if (pendingSearches.length > 0) {
        for (const call of pendingSearches) {
          const query = parseSearchWebArgs(call.args)
          const collected = await this.collectSearch(options, query, watchdog, lease)
          state.usage = addRequestUsage(state.usage, collected.usage)
          state.searchRounds.push({ query, result: collected.text })
        }
      } else if (memoQuery !== undefined) {
        const collected = await this.collectSearch(options, memoQuery, watchdog, lease)
        state.usage = addRequestUsage(state.usage, collected.usage)
        state.searchRounds.push({ query: memoQuery, result: collected.text })
      }
      const last = state.searchRounds.at(-1)
      const contents = pendingSearches.length > 0
        ? appendSearchTurns(
          input.contents,
          pendingSearches,
          pendingSearches.map((_, index) => state.searchRounds[state.searchRounds.length - pendingSearches.length + index]?.result ?? ''),
        )
        : appendSearchMemo(input.contents, memoQuery ?? '', last?.result ?? '')
      const moreSearch = state.searchRounds.length < SEARCH_FOLLOW_UP_LIMIT
      if (moreSearch) {
        state.depth += 1
        yield* this.emitChat(options, {
          ...input,
          contents,
          system: withSearchContinueGuidance(input.system),
        }, state, watchdog, lease)
        if (state.sawVisibleAnswer || state.toolNames.length > 0) return
      } else {
        input = { ...input, contents }
      }
    }

    if (skipFollowUp || state.sawVisibleAnswer || state.toolNames.length > 0) return
    if (state.answerPass && state.depth >= SEARCH_FOLLOW_UP_LIMIT) return

    state.depth += 1
    if (state.searchRounds.length > 0 && !state.answerPass) {
      state.answerPass = true
      yield* this.emitChat(options, {
        ...input,
        contents: appendSearchDossier(input.contents, state.searchRounds),
        functions: withoutSearchWeb(input.functions),
        system: withSearchContinueGuidance(`${input.system ?? ''}\n\n${SEARCH_ANSWER_GUIDANCE}`),
      }, state, watchdog, lease)
      return
    }
    yield* this.emitChat(options, {
      ...input,
      contents: appendContinueMemo(input.contents),
      functions: state.answerPass ? withoutSearchWeb(input.functions) : input.functions,
      system: withSearchContinueGuidance(input.system),
    }, state, watchdog, lease)
  }

  private async collectSearch(
    options: GenerateOptions,
    query: string,
    watchdog: IdleWatchdog,
    lease: AntigravityLease,
  ): Promise<{ text: string, usage?: CcaUsage }> {
    if (!isPublicModelId(options.model)) {
      throw new LlmError(`unknown Antigravity model "${options.model}"`, 'UNKNOWN_MODEL')
    }
    const effort = effortOf(options)
    let text = ''
    let usage: CcaUsage | undefined
    for await (const event of lease.cca.search(lease.oauth, {
      kind: 'search',
      model: routeChatModel(options.model, effort),
      query,
      ...thinkingLevelFor(options.model, effort) === undefined
        ? {}
        : { thinkingLevel: thinkingLevelFor(options.model, effort) },
    }, watchdog.signal)) {
      watchdog.touch()
      if (event.type === 'text') text += event.text
      if (event.type === 'usage') usage = mergeUsageSnapshot(usage, event.usage)
    }
    const trimmed = text.trim()
    return { text: trimmed.length > 0 ? trimmed : '(no search results)', usage }
  }

  private *closeText(state: EmitState): Generator<StreamChunk> {
    if (state.text.length === 0) return
    yield { type: 'block-end', index: state.index, block: { type: 'text', text: state.text } }
    state.index += 1
    state.text = ''
  }

  private *closeThought(state: EmitState): Generator<StreamChunk> {
    if (state.thought.length === 0) return
    yield { type: 'block-end', index: state.index, block: { type: 'reasoning', text: state.thought } }
    state.index += 1
    state.thought = ''
  }

  private async *emitImage(
    index: number,
    mimeType: string,
    data: string,
    attachments: AttachmentStore | undefined,
  ): AsyncIterable<StreamChunk> {
    if (attachments !== undefined) {
      const bytes = Buffer.from(data, 'base64')
      const attachment = await attachments.saveImage({
        data: bytes,
        mediaType: mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/gif' || mimeType === 'image/webp'
          ? mimeType
          : 'image/png',
      })
      yield { type: 'block-start', index, blockType: 'image' }
      yield { type: 'block-end', index, block: { type: 'image', attachment } }
      return
    }
    yield { type: 'block-start', index, blockType: 'text' }
    yield { type: 'text-delta', index, text: `[image ${mimeType} ${data.length} bytes]` }
    yield { type: 'block-end', index, block: { type: 'text', text: `[image ${mimeType} ${data.length} bytes]` } }
  }
}

export function createAntigravityAdapter(
  session: AntigravitySession,
  options: AntigravityAdapterOptions,
): AntigravityAdapter {
  return new AntigravityAdapter(session, options)
}
