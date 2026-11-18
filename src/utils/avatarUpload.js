export const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024
export const AVATAR_MAX_DATA_LENGTH = 64 * 1024
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateAvatarFile(file) {
  if (!file || !AVATAR_TYPES.includes(file.type)) {
    throw new Error('Choose a JPG, PNG or WebP image.')
  }
  if (!file.size || file.size > AVATAR_MAX_FILE_BYTES) {
    throw new Error('Choose an image smaller than 5 MB.')
  }
}

// Keep the existing profile API payload below its 100 KB JSON limit.
export async function prepareAvatar(file) {
  validateAvatarFile(file)
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
    } catch {
      throw new Error('This image could not be opened. Try another photo.')
    }
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image processing is unavailable. Please try another browser.')
    const side = Math.min(image.naturalWidth, image.naturalHeight)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, 256, 256)
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256)
    for (const quality of [0.85, 0.7, 0.5]) {
      const avatar = canvas.toDataURL('image/jpeg', quality)
      if (avatar.startsWith('data:image/jpeg;base64,') && avatar.length <= AVATAR_MAX_DATA_LENGTH) return avatar
    }
    throw new Error('This photo is too detailed. Please choose a simpler image.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
