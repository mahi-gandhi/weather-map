/**
 * Size and position a weather canvas over the Leaflet map container (not overlayPane).
 * @param {HTMLCanvasElement} canvas
 * @param {import('leaflet').Map} map
 * @returns {{ width: number, height: number }}
 */
export function syncWeatherCanvasToMapContainer(canvas, map) {
  const container = map.getContainer()

  canvas.style.position = 'absolute'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.pointerEvents = 'none'

  const width = Math.max(1, container.offsetWidth)
  const height = Math.max(1, container.offsetHeight)
  canvas.width = width
  canvas.height = height

  return { width, height }
}

/**
 * @param {import('leaflet').Map} map
 */
export function getMapVisibleBounds(map) {
  const bounds = map.getBounds()
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
  }
}

/**
 * @param {import('leaflet').LatLngBounds} visibleBounds
 * @param {{ getNorth: () => number, getSouth: () => number, getEast: () => number, getWest: () => number }} fetchBounds
 * @param {object} [extra]
 */
export function logTemperatureBoundsDebug(
  visibleBounds,
  fetchBounds,
  extra = {},
) {
  const north = visibleBounds.getNorth()
  const south = visibleBounds.getSouth()
  const east = visibleBounds.getEast()
  const west = visibleBounds.getWest()

  console.log('map bounds:', north, south, east, west)
  console.log(
    'fetch bounds:',
    fetchBounds.getNorth(),
    fetchBounds.getSouth(),
    fetchBounds.getEast(),
    fetchBounds.getWest(),
  )

  if (extra.canvasWidth != null) {
    console.log('canvas size:', extra.canvasWidth, extra.canvasHeight)
  }
  if (extra.gridWidth != null) {
    console.log('grid size:', extra.gridWidth, extra.gridHeight)
  }
  if (extra.sampleCount != null) {
    console.log('sample count:', extra.sampleCount)
  }
  if (extra.header) {
    const h = extra.header
    console.log('grid header:', h.lo1, h.la1, h.lo2, h.la2, h.nx, h.ny)
  }
}

/**
 * @param {number[][]} sampleMatrix
 */
export function countValidTemperatureSamples(sampleMatrix) {
  if (!sampleMatrix) return 0
  let n = 0
  for (const row of sampleMatrix) {
    for (const v of row) {
      if (v != null && !Number.isNaN(v)) n++
    }
  }
  return n
}
