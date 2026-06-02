const SAMPLE_SIZE = 7
const TEMPERATURE_SAMPLE_SIZE = 12
const PRECIPITATION_SAMPLE_SIZE = 10
const TEXTURE_SIZE = 64

/**
 * @param {string} layerId
 * @returns {number}
 */
export function getSampleSizeForLayer(layerId) {
  if (layerId === 'temperature') return TEMPERATURE_SAMPLE_SIZE
  if (layerId === 'precipitation') return PRECIPITATION_SAMPLE_SIZE
  return SAMPLE_SIZE
}

/**
 * @param {number} size
 * @param {number} [fill]
 * @returns {number[][]}
 */
export function createSampleMatrix(size, fill = NaN) {
  return Array.from({ length: size }, () => Array(size).fill(fill))
}

/**
 * @param {import('leaflet').LatLngBounds} bounds
 * @param {number} [gridSize]
 * @returns {{ lat: number, lon: number, row: number, col: number }[]}
 */
export function buildSamplePoints(bounds, gridSize = SAMPLE_SIZE) {
  const south = bounds.getSouth()
  const north = bounds.getNorth()
  const west = bounds.getWest()
  const east = bounds.getEast()
  const points = []
  const span = gridSize > 1 ? gridSize - 1 : 1

  for (let row = 0; row < gridSize; row++) {
    const lat = north - (row / span) * (north - south)
    for (let col = 0; col < gridSize; col++) {
      const lon = west + (col / span) * (east - west)
      points.push({ lat, lon, row, col })
    }
  }

  return points
}

/**
 * @param {import('leaflet').LatLngBounds} bounds
 * @param {number} [nx]
 * @param {number} [ny]
 */
export function headerFromBounds(bounds, nx = TEXTURE_SIZE, ny = TEXTURE_SIZE) {
  const south = bounds.getSouth()
  const north = bounds.getNorth()
  const west = bounds.getWest()
  const east = bounds.getEast()

  return {
    nx,
    ny,
    lo1: west,
    lo2: east,
    la1: north,
    la2: south,
    dx: nx > 1 ? (east - west) / (nx - 1) : 0,
    dy: ny > 1 ? (north - south) / (ny - 1) : 0,
  }
}

export { SAMPLE_SIZE, TEMPERATURE_SAMPLE_SIZE, PRECIPITATION_SAMPLE_SIZE, TEXTURE_SIZE }
