/**
 * Consistent swell direction from latitude (compass degrees: 0=N, 90=E).
 * @param {number} lat
 * @param {number} lng
 * @returns {number}
 */
export function swellAngleDegrees(lat, lng) {
  let angle
  if (lat > 15) angle = 45
  else if (lat >= -15) angle = 90
  else angle = 135

  angle += Math.sin(lng / 20) * 15
  return angle
}

/**
 * Lat/lng delta per frame along swell direction.
 * @param {number} lat
 * @param {number} lng
 * @param {number} speedFactor
 * @returns {{ dlat: number, dlng: number }}
 */
export function swellFlowDelta(lat, lng, speedFactor) {
  const bearingRad = (swellAngleDegrees(lat, lng) * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const cosLat = Math.max(0.15, Math.cos(latRad))

  return {
    dlat: Math.cos(bearingRad) * speedFactor,
    dlng: (Math.sin(bearingRad) * speedFactor) / cosLat,
  }
}

/**
 * Screen-space angle (radians) for drawing arrows at a map point.
 * @param {import('leaflet').Map} map
 * @param {number} lat
 * @param {number} lng
 * @param {import('leaflet').Point} origin
 * @param {number} [scale=0.05]
 * @returns {number | null}
 */
export function swellScreenAngle(map, lat, lng, origin, scale = 0.05) {
  const { dlat, dlng } = swellFlowDelta(lat, lng, scale)
  const basePt = map.latLngToLayerPoint([lat, lng])
  const tipPt = map.latLngToLayerPoint([lat + dlat, lng + dlng])

  const dx = tipPt.x - basePt.x
  const dy = tipPt.y - basePt.y
  if (Math.hypot(dx, dy) < 0.001) return null

  return Math.atan2(dy, dx)
}
