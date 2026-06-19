import { getWaveDirection } from './waveSwellDirection.js'

/**
 * Cheap curl noise from overlapping sine waves (rotational flow).
 * @param {number} x
 * @param {number} y
 * @param {number} t — frame counter for slow time evolution
 * @returns {{ vx: number, vy: number }}
 */
export function curlNoise(x, y, t) {
  const scale1 = 0.003
  const scale2 = 0.007
  const scale3 = 0.0015

  const A =
    Math.sin(x * scale1 + t * 0.0003) * Math.cos(y * scale1 * 0.8) +
    Math.sin(x * scale2 * 0.7 + y * scale2 + t * 0.0002) * 0.5 +
    Math.cos(x * scale3 - y * scale3 * 1.2 + t * 0.0001) * 0.3

  const eps = 1.0
  const Ax =
    Math.sin((x + eps) * scale1 + t * 0.0003) * Math.cos(y * scale1 * 0.8) +
    Math.sin((x + eps) * scale2 * 0.7 + y * scale2 + t * 0.0002) * 0.5 +
    Math.cos((x + eps) * scale3 - y * scale3 * 1.2 + t * 0.0001) * 0.3
  const Ay =
    Math.sin(x * scale1 + t * 0.0003) * Math.cos((y + eps) * scale1 * 0.8) +
    Math.sin(x * scale2 * 0.7 + (y + eps) * scale2 + t * 0.0002) * 0.5 +
    Math.cos(x * scale3 - (y + eps) * scale3 * 1.2 + t * 0.0001) * 0.3

  return {
    vx: -(Ay - A) / eps,
    vy: (Ax - A) / eps,
  }
}

/**
 * Weak wave-height gradient bias in screen space.
 * @param {import('leaflet').Map} map
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @param {number} [strength=0.3]
 * @returns {{ vx: number, vy: number }}
 */
export function gradientScreenBias(map, lat, lng, data, strength = 0.3) {
  const angleRad = (getWaveDirection(lat, lng, data) * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const cosLat = Math.max(0.15, Math.cos(latRad))
  const dlat = Math.cos(angleRad) * 0.01
  const dlng = (Math.sin(angleRad) * 0.01) / cosLat
  const p0 = map.latLngToContainerPoint([lat, lng])
  const p1 = map.latLngToContainerPoint([lat + dlat, lng + dlng])
  let vx = p1.x - p0.x
  let vy = p1.y - p0.y
  const len = Math.hypot(vx, vy) || 1
  return { vx: (vx / len) * strength, vy: (vy / len) * strength }
}

/**
 * Curl noise (dominant) + wave gradient bias (secondary).
 * @param {import('leaflet').Map} map
 * @param {number} lat
 * @param {number} lng
 * @param {number} px
 * @param {number} py
 * @param {number} frame
 * @param {ArrayLike<number>} data
 * @param {number} speed
 * @returns {{ vx: number, vy: number }}
 */
export function waveParticleTargetVelocity(map, lat, lng, px, py, frame, data, speed) {
  const curl = curlNoise(px, py, frame)
  const grad = gradientScreenBias(map, lat, lng, data, 0.3)
  return {
    vx: curl.vx * speed + grad.vx,
    vy: curl.vy * speed + grad.vy,
  }
}
