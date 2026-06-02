/** Windy-style wind speed colors (km/h). */
export const WINDY_SPEED_STOPS = [
  { value: 0, rgb: [0x00, 0x00, 0x00] },
  { value: 10, rgb: [0x0a, 0x1f, 0x6e] },
  { value: 20, rgb: [0x1a, 0x78, 0xc2] },
  { value: 40, rgb: [0x00, 0xc8, 0xff] },
  { value: 60, rgb: [0x00, 0xff, 0x96] },
  { value: 80, rgb: [0xff, 0xff, 0x00] },
  { value: 100, rgb: [0xff, 0x66, 0x00] },
  { value: 120, rgb: [0xff, 0x00, 0x00] },
]

/** @type {{ value: number, rgba: [number, number, number, number] }[]} */
export const WINDY_PHYSICAL_STOPS = [
  { value: 0, rgba: [0x00, 0x00, 0x00, 0] },
  { value: 10, rgba: [0x0a, 0x1f, 0x6e, 210] },
  { value: 20, rgba: [0x1a, 0x78, 0xc2, 215] },
  { value: 40, rgba: [0x00, 0xc8, 0xff, 220] },
  { value: 60, rgba: [0x00, 0xff, 0x96, 225] },
  { value: 80, rgba: [0xff, 0xff, 0x00, 230] },
  { value: 100, rgba: [0xff, 0x66, 0x00, 235] },
  { value: 120, rgba: [0xff, 0x00, 0x00, 240] },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpRgb(a, b, t) {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ]
}

/**
 * @param {number} speedKmh
 * @returns {[number, number, number, number]}
 */
export function sampleWindyColor(speedKmh) {
  const speed = Math.max(0, speedKmh)

  if (speed <= 0) {
    return [0, 0, 0, 0]
  }

  for (let i = 0; i < WINDY_PHYSICAL_STOPS.length - 1; i++) {
    const start = WINDY_PHYSICAL_STOPS[i]
    const end = WINDY_PHYSICAL_STOPS[i + 1]
    if (speed <= end.value) {
      const range = end.value - start.value
      const t = range === 0 ? 1 : (speed - start.value) / range
      return [
        lerpChannel(start.rgba[0], end.rgba[0], t),
        lerpChannel(start.rgba[1], end.rgba[1], t),
        lerpChannel(start.rgba[2], end.rgba[2], t),
        lerpChannel(start.rgba[3], end.rgba[3], t),
      ]
    }
  }

  const last = WINDY_PHYSICAL_STOPS[WINDY_PHYSICAL_STOPS.length - 1]
  return [...last.rgba]
}

function lerpChannel(a, b, t) {
  return Math.round(lerp(a, b, t))
}

/**
 * @param {number} speedKmh
 * @returns {[number, number, number]}
 */
export function sampleWindyRgb(speedKmh) {
  const [r, g, b] = sampleWindyColor(speedKmh, 255)
  return [r, g, b]
}
