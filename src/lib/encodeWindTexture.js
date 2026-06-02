export const WIND_TEXTURE_NX = 256
export const WIND_TEXTURE_NY = 128

/**
 * Encode U/V wind components into RGBA ImageData for WebGL (256×128).
 * R = U packed, G = V packed: byte = clamp(U + 127.5) per Windy-style encoding.
 * @param {Float32Array | ArrayLike<number>} uGrid
 * @param {Float32Array | ArrayLike<number>} vGrid
 * @param {number} nx
 * @param {number} ny
 * @param {number} [texWidth]
 * @param {number} [texHeight]
 */
export function encodeWindTexture(
  uGrid,
  vGrid,
  nx,
  ny,
  texWidth = WIND_TEXTURE_NX,
  texHeight = WIND_TEXTURE_NY,
) {
  const imageData = new ImageData(texWidth, texHeight)
  const pixels = imageData.data

  let uMin = Infinity
  let uMax = -Infinity
  let vMin = Infinity
  let vMax = -Infinity

  const count = nx * ny
  for (let i = 0; i < count; i++) {
    const u = uGrid[i] ?? 0
    const v = vGrid[i] ?? 0
    if (u < uMin) uMin = u
    if (u > uMax) uMax = u
    if (v < vMin) vMin = v
    if (v > vMax) vMax = v
  }

  if (!Number.isFinite(uMin)) uMin = -20
  if (!Number.isFinite(uMax)) uMax = 20
  if (!Number.isFinite(vMin)) vMin = -20
  if (!Number.isFinite(vMax)) vMax = 20

  const uPad = Math.max(1, (uMax - uMin) * 0.05)
  const vPad = Math.max(1, (vMax - vMin) * 0.05)
  uMin -= uPad
  uMax += uPad
  vMin -= vPad
  vMax += vPad

  for (let ty = 0; ty < texHeight; ty++) {
    const gy = (ty / (texHeight - 1)) * (ny - 1)
    const y0 = Math.floor(gy)
    const y1 = Math.min(y0 + 1, ny - 1)
    const fy = gy - y0

    for (let tx = 0; tx < texWidth; tx++) {
      const gx = (tx / (texWidth - 1)) * (nx - 1)
      const x0 = Math.floor(gx)
      const x1 = Math.min(x0 + 1, nx - 1)
      const fx = gx - x0

      const u =
        lerp2d(uGrid, nx, x0, y0, x1, y1, fx, fy)
      const v =
        lerp2d(vGrid, nx, x0, y0, x1, y1, fx, fy)

      const o = (ty * texWidth + tx) * 4
      pixels[o] = packWindComponent(u, uMin, uMax)
      pixels[o + 1] = packWindComponent(v, vMin, vMax)
      pixels[o + 2] = 0
      pixels[o + 3] = 255
    }
  }

  return {
    imageData,
    uMin: [uMin, vMin],
    uMax: [uMax, vMax],
    width: texWidth,
    height: texHeight,
  }
}

function lerp2d(grid, nx, x0, y0, x1, y1, fx, fy) {
  const v00 = grid[y0 * nx + x0] ?? 0
  const v10 = grid[y0 * nx + x1] ?? 0
  const v01 = grid[y1 * nx + x0] ?? 0
  const v11 = grid[y1 * nx + x1] ?? 0
  const top = v00 + (v10 - v00) * fx
  const bottom = v01 + (v11 - v01) * fx
  return top + (bottom - top) * fy
}

function packWindComponent(value, min, max) {
  const t = (value - min) / (max - min || 1)
  const normalized = t * 255
  return Math.max(0, Math.min(255, Math.round(normalized)))
}

/**
 * Decode wind from texture sample (0–1) given min/max vectors.
 * @param {number} r
 * @param {number} g
 * @param {[number, number]} windMin
 * @param {[number, number]} windMax
 */
export function decodeWindFromTexture(r, g, windMin, windMax) {
  const u = windMin[0] + (r / 255) * (windMax[0] - windMin[0])
  const v = windMin[1] + (g / 255) * (windMax[1] - windMin[1])
  return [u, v]
}
