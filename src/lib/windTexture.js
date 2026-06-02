import { encodeWindFieldUint8 } from './webglFloatTextures.js'

/**
 * Build a RGBA wind field texture: R=u, G=v, B=speed (km/h), A=1.
 * @param {import('regl').Regl} regl
 * @param {{ nx: number, ny: number }} header
 * @param {ArrayLike<number>} u
 * @param {ArrayLike<number>} v
 * @param {{ hasFloat?: boolean }} [options]
 */
export function createWindTexture(regl, header, u, v, options = {}) {
  const { hasFloat = true } = options
  const { nx, ny } = header
  const count = nx * ny

  if (hasFloat) {
    const data = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const ui = u[i] ?? 0
      const vi = v[i] ?? 0
      const offset = i * 4
      data[offset] = ui
      data[offset + 1] = vi
      data[offset + 2] = Math.hypot(ui, vi)
      data[offset + 3] = 1
    }

    return regl.texture({
      width: nx,
      height: ny,
      data,
      format: 'rgba',
      type: 'float',
      mag: 'linear',
      min: 'linear',
      wrap: 'clamp',
    })
  }

  const data = encodeWindFieldUint8(u, v, count)

  return regl.texture({
    width: nx,
    height: ny,
    data,
    format: 'rgba',
    type: 'uint8',
    mag: 'linear',
    min: 'linear',
    wrap: 'clamp',
  })
}
