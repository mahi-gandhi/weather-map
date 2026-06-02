import { SAMPLE_SIZE } from './sampleGrid.js'

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Bilinear sample on a regular sample grid.
 * @param {number[][]} samples
 * @param {number} tx column position (0 … gridSize − 1)
 * @param {number} ty row position
 * @param {number} [gridSize]
 */
export function bilinearSample(samples, tx, ty, gridSize = SAMPLE_SIZE) {
  const x = Math.max(0, Math.min(gridSize - 1, tx))
  const y = Math.max(0, Math.min(gridSize - 1, ty))
  const x0 = Math.floor(x)
  const x1 = Math.min(x0 + 1, gridSize - 1)
  const y0 = Math.floor(y)
  const y1 = Math.min(y0 + 1, gridSize - 1)
  const fx = x - x0
  const fy = y - y0

  const v00 = samples[y0][x0]
  const v10 = samples[y0][x1]
  const v01 = samples[y1][x0]
  const v11 = samples[y1][x1]

  const top = lerp(v00, v10, fx)
  const bottom = lerp(v01, v11, fx)
  return lerp(top, bottom, fy)
}

function isValidSample(value) {
  return value != null && !Number.isNaN(value)
}

/**
 * Bilinear sample that ignores missing (land) sample points.
 * @param {number[][]} samples
 * @param {number} tx
 * @param {number} ty
 */
export function bilinearSampleSparse(samples, tx, ty, gridSize = SAMPLE_SIZE) {
  const x = Math.max(0, Math.min(gridSize - 1, tx))
  const y = Math.max(0, Math.min(gridSize - 1, ty))
  const x0 = Math.floor(x)
  const x1 = Math.min(x0 + 1, gridSize - 1)
  const y0 = Math.floor(y)
  const y1 = Math.min(y0 + 1, gridSize - 1)
  const fx = x - x0
  const fy = y - y0

  const corners = [
    { v: samples[y0][x0], w: (1 - fx) * (1 - fy) },
    { v: samples[y0][x1], w: fx * (1 - fy) },
    { v: samples[y1][x0], w: (1 - fx) * fy },
    { v: samples[y1][x1], w: fx * fy },
  ]

  const valid = corners.filter((c) => isValidSample(c.v))
  if (valid.length === 0) return NaN

  const weightSum = valid.reduce((sum, c) => sum + c.w, 0)
  if (weightSum <= 0) return valid[0].v

  return valid.reduce((sum, c) => sum + c.v * (c.w / weightSum), 0)
}

/**
 * @param {number[][]} samples5x5
 * @param {{ nx: number, ny: number, lo1: number, lo2: number, la1: number, la2: number, dx: number, dy: number }} header
 * @returns {number[]}
 */
export function interpolateScalarGrid(samples5x5, header, gridSize = SAMPLE_SIZE) {
  const data = new Array(header.nx * header.ny)
  const latSpan = header.la1 - header.la2
  const lonSpan = header.lo2 - header.lo1
  const maxIndex = gridSize - 1

  for (let row = 0; row < header.ny; row++) {
    const lat = header.la1 - row * header.dy
    const ty = latSpan === 0 ? 0 : ((header.la1 - lat) / latSpan) * maxIndex

    for (let col = 0; col < header.nx; col++) {
      const lon = header.lo1 + col * header.dx
      const tx = lonSpan === 0 ? 0 : ((lon - header.lo1) / lonSpan) * maxIndex
      data[row * header.nx + col] = bilinearSample(samples5x5, tx, ty, gridSize)
    }
  }

  return data
}

/**
 * @param {number[][]} samples5x5 — NaN marks land / missing marine samples
 * @param {{ nx: number, ny: number, lo1: number, lo2: number, la1: number, la2: number, dx: number, dy: number }} header
 * @returns {number[]}
 */
export function interpolateScalarGridSparse(samples5x5, header, gridSize = SAMPLE_SIZE) {
  const data = new Array(header.nx * header.ny)
  const latSpan = header.la1 - header.la2
  const lonSpan = header.lo2 - header.lo1
  const maxIndex = gridSize - 1

  for (let row = 0; row < header.ny; row++) {
    const lat = header.la1 - row * header.dy
    const ty = latSpan === 0 ? 0 : ((header.la1 - lat) / latSpan) * maxIndex

    for (let col = 0; col < header.nx; col++) {
      const lon = header.lo1 + col * header.dx
      const tx = lonSpan === 0 ? 0 : ((lon - header.lo1) / lonSpan) * maxIndex
      data[row * header.nx + col] = bilinearSampleSparse(
        samples5x5,
        tx,
        ty,
        gridSize,
      )
    }
  }

  return data
}

/**
 * @param {number[][]} uSamples
 * @param {number[][]} vSamples
 * @param {object} header
 * @returns {{ u: number[], v: number[] }}
 */
export function interpolateVectorGrid(uSamples, vSamples, header) {
  return {
    u: interpolateScalarGrid(uSamples, header),
    v: interpolateScalarGrid(vSamples, header),
  }
}
