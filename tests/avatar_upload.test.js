import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareAvatar, validateAvatarFile, AVATAR_MAX_FILE_BYTES, AVATAR_MAX_DATA_LENGTH } from '../src/utils/avatarUpload.js'

const photo = { type: 'image/png', size: 4096 }

test('avatar accepts supported images and rejects oversized, empty and unsupported files', () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    assert.doesNotThrow(() => validateAvatarFile({ ...photo, type }))
  }
  for (const file of [null, { ...photo, type: 'image/svg+xml' }, { ...photo, type: 'text/plain' }, { ...photo, size: 0 }, { ...photo, size: AVATAR_MAX_FILE_BYTES + 1 }]) {
    assert.throws(() => validateAvatarFile(file))
  }
})

test('avatar crops to a square, compresses under API limit, and releases the preview URL', async (t) => {
  const originalImage = globalThis.Image
  const originalDocument = globalThis.document
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL
  t.after(() => {
    globalThis.Image = originalImage
    globalThis.document = originalDocument
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })
  let revoked
  let drawArgs
  const qualities = []
  URL.createObjectURL = () => 'blob:test-avatar'
  URL.revokeObjectURL = (url) => { revoked = url }
  globalThis.Image = class {
    naturalWidth = 800
    naturalHeight = 600
    async decode() {}
  }
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({ fillRect() {}, drawImage(...args) { drawArgs = args } }),
      toDataURL(type, quality) {
        assert.equal(type, 'image/jpeg')
        qualities.push(quality)
        return 'data:image/jpeg;base64,' + 'a'.repeat(quality > 0.7 ? AVATAR_MAX_DATA_LENGTH : 1024)
      },
    }),
  }
  const result = await prepareAvatar(photo)
  assert.ok(result.length <= AVATAR_MAX_DATA_LENGTH)
  assert.deepEqual(drawArgs.slice(1), [100, 0, 600, 600, 0, 0, 256, 256])
  assert.deepEqual(qualities, [0.85, 0.7])
  assert.equal(revoked, 'blob:test-avatar')

  globalThis.Image = class { async decode() { throw new Error('invalid image') } }
  revoked = null
  await assert.rejects(() => prepareAvatar(photo), /could not be opened/)
  assert.equal(revoked, 'blob:test-avatar')
})
