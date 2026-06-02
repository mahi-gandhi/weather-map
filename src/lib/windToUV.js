/**
 * Meteorological wind direction (degrees, "from") → u/v components.
 * @param {number} speed
 * @param {number} directionDeg
 * @returns {{ u: number, v: number }}
 */
export function speedDirToUV(speed, directionDeg) {
  const rad = (directionDeg * Math.PI) / 180
  return {
    u: -speed * Math.sin(rad),
    v: -speed * Math.cos(rad),
  }
}

/**
 * @param {number} kmh
 * @returns {number} knots
 */
export function kmhToKnots(kmh) {
  return kmh * 0.539957
}
