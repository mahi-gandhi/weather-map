const LUT_SIZE = 256

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hueToRgb(p, q, t) {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    Math.round(hueToRgb(p, q, h) * 255),
    Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  ]
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Sample color along stops with smooth HSL interpolation between RGBA stops.
 * @param {number} value
 * @param {{ value: number, rgba: [number, number, number, number] }[]} stops
 * @param {number} minVisible
 * @returns {[number, number, number, number]}
 */
export function sampleStopsHsl(value, stops, minVisible = 0) {
  if (value == null || Number.isNaN(value) || value < minVisible) {
    return [0, 0, 0, 0]
  }

  if (value <= stops[0].value) {
    return value <= 0 ? [0, 0, 0, 0] : [...stops[0].rgba]
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const start = stops[i]
    const end = stops[i + 1]
    if (value <= end.value) {
      const range = end.value - start.value
      const t = range === 0 ? 1 : (value - start.value) / range

      const hsl0 = rgbToHsl(start.rgba[0], start.rgba[1], start.rgba[2])
      const hsl1 = rgbToHsl(end.rgba[0], end.rgba[1], end.rgba[2])

      let h = lerp(hsl0[0], hsl1[0], t)
      if (Math.abs(hsl1[0] - hsl0[0]) > 0.5) {
        if (hsl1[0] > hsl0[0]) h = lerp(hsl0[0] + 1, hsl1[0], t)
        else h = lerp(hsl0[0], hsl1[0] + 1, t)
        if (h >= 1) h -= 1
      }

      const s = lerp(hsl0[1], hsl1[1], t)
      const l = lerp(hsl0[2], hsl1[2], t)
      const [r, g, b] = hslToRgb(h, s, l)

      return [
        r,
        g,
        b,
        Math.round(lerp(start.rgba[3], end.rgba[3], t)),
      ]
    }
  }

  return [...stops[stops.length - 1].rgba]
}

/**
 * @param {{ value: number, rgba: [number, number, number, number] }[]} stops
 * @param {number} [minVisible]
 * @param {number} [maxValue] — defaults to last stop value
 * @returns {{ lut: Uint8ClampedArray, min: number, max: number }}
 */
export function buildPhysicalColorLut(stops, minVisible = 0, maxValue) {
  const min = stops[0].value
  const max = maxValue ?? stops[stops.length - 1].value
  const lut = new Uint8ClampedArray(LUT_SIZE * 4)
  const span = max - min || 1

  for (let i = 0; i < LUT_SIZE; i++) {
    const value = min + (i / (LUT_SIZE - 1)) * span
    const [r, g, b, a] = sampleStopsHsl(value, stops, minVisible)
    const o = i * 4
    lut[o] = r
    lut[o + 1] = g
    lut[o + 2] = b
    lut[o + 3] = a
  }

  return { lut, min, max }
}

/**
 * @param {{ pos: number, rgba: [number, number, number, number] }[]} ramp
 * @returns {{ lut: Uint8ClampedArray, min: number, max: number }}
 */
export function buildNormalizedRampLut(ramp) {
  const stops = ramp.map((s) => ({
    value: s.pos,
    rgba: s.rgba,
  }))
  return buildPhysicalColorLut(stops, 0, 1)
}

/**
 * @param {number} value
 * @param {Uint8ClampedArray} lut
 * @param {number} min
 * @param {number} max
 * @returns {number} LUT index 0–255
 */
export function valueToLutIndex(value, min, max) {
  if (max <= min) return 0
  const t = (value - min) / (max - min)
  return Math.max(0, Math.min(LUT_SIZE - 1, Math.round(t * (LUT_SIZE - 1))))
}

export { LUT_SIZE }
