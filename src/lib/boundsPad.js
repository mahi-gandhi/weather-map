const DEFAULT_PAD = 0.2

/**
 * Extend bounds by a fraction of span on each side (for off-screen heatmap margin).
 * @param {import('leaflet').LatLngBounds} bounds
 * @param {number} [pad]
 * @returns {{ getSouth: () => number, getNorth: () => number, getWest: () => number, getEast: () => number }}
 */
export function padLeafletBounds(bounds, pad = DEFAULT_PAD) {
  const south = bounds.getSouth()
  const north = bounds.getNorth()
  const west = bounds.getWest()
  const east = bounds.getEast()
  const latPad = (north - south) * pad
  const lonPad = (east - west) * pad

  return {
    getSouth: () => south - latPad,
    getNorth: () => north + latPad,
    getWest: () => west - lonPad,
    getEast: () => east + lonPad,
  }
}

/**
 * @param {string} layerId
 * @param {import('leaflet').LatLngBounds} visibleBounds
 */
export function getLayerFetchBounds(layerId, visibleBounds) {
  if (layerId === 'temperature') {
    return padLeafletBounds(visibleBounds, 0.3)
  }
  return visibleBounds
}
