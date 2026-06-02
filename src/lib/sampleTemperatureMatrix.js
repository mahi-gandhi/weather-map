import { bilinearSample, bilinearSampleSparse } from './interpolateGrid.js'

function isValidSample(value) {
  return value != null && !Number.isNaN(value)
}

/**
 * Bilinear sample without extrapolation beyond the sample grid.
 * @param {number[][]} samples
 * @param {number} tx
 * @param {number} ty
 * @param {number} gridSize
 * @returns {number | null}
 */
function bilinearSampleInGrid(samples, tx, ty, gridSize) {
  const maxIndex = gridSize - 1
  if (tx < 0 || tx > maxIndex || ty < 0 || ty > maxIndex) {
    return null
  }

  const x0 = Math.floor(tx)
  const y0 = Math.floor(ty)
  const x1 = Math.min(x0 + 1, maxIndex)
  const y1 = Math.min(y0 + 1, maxIndex)

  const v00 = samples[y0][x0]
  const v10 = samples[y0][x1]
  const v01 = samples[y1][x0]
  const v11 = samples[y1][x1]

  const allValid =
    isValidSample(v00) &&
    isValidSample(v10) &&
    isValidSample(v01) &&
    isValidSample(v11)

  if (allValid) {
    return bilinearSample(samples, tx, ty, gridSize)
  }

  const sparse = bilinearSampleSparse(samples, tx, ty, gridSize)
  if (sparse == null || Number.isNaN(sparse)) return null
  return sparse
}

/**
 * Bilinear temperature (°C) from a sample matrix at lat/lng.
 * Returns null outside geographic bounds or when extrapolation would be required.
 * @param {number[][]} samples
 * @param {number} gridSize
 * @param {number} lat
 * @param {number} lng
 * @param {{ south: number, north: number, west: number, east: number }} bounds
 * @returns {number | null}
 */
export function sampleTemperatureAtLatLng(
  samples,
  gridSize,
  lat,
  lng,
  bounds,
) {
  const { south, north, west, east } = bounds
  if (lat < south || lat > north) return null

  let lon = lng
  if (east - west >= 180) {
    while (lon < west) lon += 360
    while (lon > east) lon -= 360
  }
  if (lon < west || lon > east) return null

  const latSpan = north - south
  const lonSpan = east - west
  const maxIndex = gridSize - 1

  const ty = latSpan === 0 ? 0 : ((north - lat) / latSpan) * maxIndex
  const tx = lonSpan === 0 ? 0 : ((lon - west) / lonSpan) * maxIndex

  const value = bilinearSampleInGrid(samples, tx, ty, gridSize)
  if (value == null || Number.isNaN(value)) return null
  return value
}

/**
 * @param {{ la1: number, la2: number, lo1: number, lo2: number }} header
 */
export function boundsFromHeader(header) {
  return {
    south: Math.min(header.la1, header.la2),
    north: Math.max(header.la1, header.la2),
    west: Math.min(header.lo1, header.lo2),
    east: Math.max(header.lo1, header.lo2),
  }
}

/**
 * Lat/lon at sample grid node (row 0 = north).
 * @param {number} row
 * @param {number} col
 * @param {number} gridSize
 * @param {{ south: number, north: number, west: number, east: number }} bounds
 */
export function sampleNodeLatLng(row, col, gridSize, bounds) {
  const span = gridSize > 1 ? gridSize - 1 : 1
  const lat = bounds.north - (row / span) * (bounds.north - bounds.south)
  const lon =
    bounds.west + (col / span) * (bounds.east - bounds.west)
  return { lat, lon }
}
