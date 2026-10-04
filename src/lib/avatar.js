// Avatar upload to the public `player-avatars` Supabase Storage bucket.
// Photos are downscaled in the browser first — avatars render at 14–96px, so a
// multi-megabyte phone photo would only waste the squad's mobile data.
import { supabase } from './supabase'

const MAX_EDGE = 384
const BUCKET = 'player-avatars'

// Centre-crop to a square and downscale to a JPEG blob. Falls back to the original file
// if the browser can't decode it (e.g. HEIC on some desktops).
async function toSquareJpeg(file) {
  try {
    const bitmap = await createImageBitmap(file)
    const side = Math.min(bitmap.width, bitmap.height)
    const size = Math.min(MAX_EDGE, side)
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    canvas.getContext('2d').drawImage(
      bitmap,
      (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
      0, 0, size, size,
    )
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ? { body: blob, ext: 'jpg', contentType: 'image/jpeg' } : null
  } catch {
    return null
  }
}

// Returns the public URL (cache-busted so a replaced photo shows immediately). Throws on failure.
export async function uploadAvatar(playerId, file) {
  const prepared = (await toSquareJpeg(file)) ?? {
    body: file,
    ext: file.name.split('.').pop(),
    contentType: file.type,
  }
  const path = `${playerId}.${prepared.ext}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, prepared.body, { upsert: true, contentType: prepared.contentType })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return `${data.publicUrl}?t=${Date.now()}`
}
