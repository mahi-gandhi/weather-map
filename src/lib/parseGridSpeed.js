import { LAYERS } from './layers.js'

/**
 * Normalize scalar grid for normalized color ramp (0–1).
 * @param {number[]} data
 * @returns {Float32Array}
 */
export function normalizeScalar(data) {
  const out = new Float32Array(data.length)
  let min = Infinity
  let max = -Infinity

  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (v < min) min = v
    if (v > max) max = v
  }

  const range = max - min
  if (range === 0) {
    out.fill(0)
    return out
  }

  for (let i = 0; i < data.length; i++) {
    out[i] = (data[i] - min) / range
  }

  return out
}

/**
 * @param {Array<{ header: object, data: number[] }>} grids
 * @param {string} layerId
 */
export function parseGridForDisplay(grids, layerId) {
  const layer = LAYERS[layerId]
  const { header, data } = grids[0]

  if (layer?.physicalRamp) {
    const values =
      layerId === 'wind' && grids.length > 2
        ? new Float32Array(grids[2].data)
        : new Float32Array(data)
    return {
      header,
      values,
      physical: true,
    }
  }

  if (grids.length > 1) {
    const speeds = new Float32Array(data.length)
    for (let i = 0; i < data.length; i++) {
      speeds[i] = Math.hypot(data[i], grids[1].data[i])
    }
    return {
      header,
      values: normalizeScalar(Array.from(speeds)),
      physical: false,
    }
  }

  return {
    header,
    values: normalizeScalar(data),
    physical: false,
  }
}
