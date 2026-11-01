import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'

type ImageContentBlock = Extract<ContentBlock, { type: 'image' }>

export type ResolvedImage =
  | { type: 'inline', mimeType: string, data: string }
  | { type: 'placeholder', text: string }

export async function resolveImageBlock(
  block: ImageContentBlock,
  attachments?: AttachmentStore,
  signal?: AbortSignal,
): Promise<ResolvedImage> {
  const name = block.attachment?.name || block.attachment?.attachmentId || 'image'
  if (block.offloaded === true) return { type: 'placeholder', text: `[Image: ${name} (offloaded)]` }
  if (attachments !== undefined && block.attachment !== undefined) {
    try {
      const stored = await attachments.readImage(block.attachment, signal)
      if (stored?.data && stored.data.length > 0) {
        return {
          type: 'inline',
          mimeType: stored.ref?.mediaType || block.attachment?.mediaType || 'image/png',
          data: Buffer.from(stored.data).toString('base64'),
        }
      }
    } catch (error) {
      if (signal?.aborted) throw error
      // Graceful fallback to placeholder text if storage read fails
    }
  }
  return { type: 'placeholder', text: `[Image: ${name}]` }
}
