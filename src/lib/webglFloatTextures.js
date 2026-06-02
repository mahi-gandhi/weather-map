/** Max wind component magnitude (km/h) when encoding to uint8 textures. */
export const WIND_TEXTURE_SCALE = 120

/**
 * @param {WebGLRenderingContext} gl
 */
export function detectFloatTextureSupport(gl) {
  const floatExt = gl.getExtension('OES_texture_float')
  const floatLinear = gl.getExtension('OES_texture_float_linear')
  return { supported: Boolean(floatExt), floatLinear: Boolean(floatLinear) }
}

/**
 * @param {Float32Array} floatData — RGBA 0–1 normalized positions
 */
export function floatToUint8TextureData(floatData) {
  const out = new Uint8Array(floatData.length)
  for (let i = 0; i < floatData.length; i++) {
    const clamped = Math.max(0, Math.min(1, floatData[i]))
    out[i] = Math.floor(clamped * 255)
  }
  return out
}

/**
 * @param {ArrayLike<number>} u — km/h
 * @param {ArrayLike<number>} v — km/h
 * @param {number} count
 */
export function encodeWindFieldUint8(u, v, count) {
  const scale = WIND_TEXTURE_SCALE
  const data = new Uint8Array(count * 4)

  for (let i = 0; i < count; i++) {
    const ui = u[i] ?? 0
    const vi = v[i] ?? 0
    const speed = Math.hypot(ui, vi)
    const offset = i * 4
    data[offset] = Math.round(Math.max(0, Math.min(255, ((ui / scale) + 1) * 0.5 * 255)))
    data[offset + 1] = Math.round(Math.max(0, Math.min(255, ((vi / scale) + 1) * 0.5 * 255)))
    data[offset + 2] = Math.round(Math.max(0, Math.min(255, (speed / scale) * 255)))
    data[offset + 3] = 255
  }

  return data
}
