import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { offloadedImageText } from '@deepseek-ai/dsh-llm'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'

type ImageContentBlock = Extract<ContentBlock, { type: 'image' }>
type ImageRef = ImageContentBlock['attachment']

export type ImageAccessResolver = (ref: ImageRef) => Parameters<typeof offloadedImageText>[1]

export type ResolvedImage =
  | { type: 'inline', mimeType: string, data: string }
  | { type: 'placeholder', text: string }

function accessOf(ref: ImageRef, resolveAccess?: ImageAccessResolver): ReturnType<ImageAccessResolver> {
  try {
    return resolveAccess?.(ref)
  } catch {
    // An invalid reference has no path, and the placeholder says so
    return undefined
  }
}

export async function resolveImageBlock(
  block: ImageContentBlock,
  attachments?: AttachmentStore,
  signal?: AbortSignal,
  resolveAccess?: ImageAccessResolver,
): Promise<ResolvedImage> {
  const name = block.attachment?.name || block.attachment?.attachmentId || 'image'
  if (block.offloaded === true) {
    return { type: 'placeholder', text: offloadedImageText(block.attachment, accessOf(block.attachment, resolveAccess)) }
  }
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
