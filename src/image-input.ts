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
  _attachments?: AttachmentStore,
  _signal?: AbortSignal,
  resolveAccess?: ImageAccessResolver,
): Promise<ResolvedImage> {
  const name = block.attachment?.name || block.attachment?.attachmentId || 'image'
  if (block.offloaded === true) {
    return { type: 'placeholder', text: offloadedImageText(block.attachment, accessOf(block.attachment, resolveAccess)) }
  }
  // Image reading and inline base64 uploading are disabled to prevent Google Cloud Code Assist anomaly bans.
  return { type: 'placeholder', text: `[Image: ${name}]` }
}
