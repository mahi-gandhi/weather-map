import { GRID_COLS } from './waveStaticGrid.js'

/**
 * Swell flow direction from wave-height gradient (compass degrees: 0=N, 90=E).
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @returns {number}
 */
export function getWaveDirection(lat, lng, data) {
  const lon = ((lng % 360) + 360) % 360
  const col = Math.floor(lon)
  const row = Math.floor(90 - lat)

  if (row < 3 || row > 177 || col < 0 || col >= GRID_COLS) return 0

  const sample = (r, c) => {
    const rr = Math.max(0, Math.min(180, r))
    const cc = ((c % GRID_COLS) + GRID_COLS) % GRID_COLS
    return data[rr * GRID_COLS + cc] || 0
  }

  const hN = sample(row - 3, col)
  const hS = sample(row + 3, col)
  const hE = sample(row, col + 3)
  const hW = sample(row, col - 3)

  const dx = hE - hW
  const dy = hS - hN
  const mag = Math.sqrt(dx * dx + dy * dy)

  if (mag < 0.005) {
    return lat > 0 ? 270 : 90
  }

  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
  return (angle + 360) % 360
}

export function waveScreenVelocity(map, lat, lng, data, speed) {
  const angleDeg = getWaveDirection(lat, lng, data)
  const bearingRad = (angleDeg * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const cosLat = Math.max(0.15, Math.cos(latRad))
  const dlat = Math.cos(bearingRad) * 0.01
  const dlng = (Math.sin(bearingRad) * 0.01) / cosLat
  const p0 = map.latLngToContainerPoint([lat, lng])
  const p1 = map.latLngToContainerPoint([lat + dlat, lng + dlng])
  let vx = p1.x - p0.x
  let vy = p1.y - p0.y
  const len = Math.hypot(vx, vy) || 1
  return { vx: (vx / len) * speed, vy: (vy / len) * speed }
}

/**
 * Target lat/lng velocity from local wave gradient.
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @param {number} speedFactor
 * @returns {{ dlat: number, dlng: number }}
 */
export function waveFlowVelocity(lat, lng, data, speedFactor) {
  return flowDeltaFromAngle(lat, getWaveDirection(lat, lng, data), speedFactor)
}

/**
 * Lat/lng delta per frame along a compass bearing.
 * @param {number} lat
 * @param {number} angleDeg
 * @param {number} speedFactor
 * @returns {{ dlat: number, dlng: number }}
 */
export function flowDeltaFromAngle(lat, angleDeg, speedFactor) {
  const bearingRad = (angleDeg * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const cosLat = Math.max(0.15, Math.cos(latRad))
  return {
    dlat: Math.cos(bearingRad) * speedFactor,
    dlng: (Math.sin(bearingRad) * speedFactor) / cosLat,
  }
}

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
