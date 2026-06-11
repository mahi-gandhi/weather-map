/** Windy-style wave height color stops (meters → RGB). */
export const WAVE_COLOR_STOPS = [
  { value: 0.3, rgb: [30, 60, 255] },
  { value: 0.8, rgb: [0, 140, 255] },
  { value: 1.5, rgb: [0, 210, 255] },
  { value: 2.5, rgb: [0, 255, 180] },
  { value: 3.5, rgb: [120, 255, 80] },
  { value: 4.5, rgb: [255, 230, 0] },
  { value: 5.5, rgb: [255, 140, 0] },
  { value: 7.0, rgb: [255, 30, 0] },
]

export const WAVE_LUT_SIZE = 1024
export const WAVE_OVERLAY_ALPHA = 200
export const WAVE_TRANSPARENT_THRESHOLD = 0.05

/** Particle trail colors (RGBA 0–255). */
export const WAVE_PARTICLE_COLOR_STOPS = [
  { value: 0.5, rgba: [30, 100, 255, 120] },
  { value: 2.0, rgba: [0, 200, 255, 150] },
  { value: 4.0, rgba: [255, 220, 0, 160] },
  { value: 6.0, rgba: [255, 60, 0, 170] },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

function lerpRgbStops(stops, value) {
  if (value == null || Number.isNaN(value) || value < stops[0].value) {
    return null
  }

  if (value >= stops[stops.length - 1].value) {
    return stops[stops.length - 1].rgb
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (value <= b.value) {
      const t = (value - a.value) / (b.value - a.value)
      return [
        Math.round(lerp(a.rgb[0], b.rgb[0], t)),
        Math.round(lerp(a.rgb[1], b.rgb[1], t)),
        Math.round(lerp(a.rgb[2], b.rgb[2], t)),
      ]
    }
  }

  return stops[stops.length - 1].rgb
}

function lerpRgbaStops(stops, value) {
  if (value == null || Number.isNaN(value) || value < stops[0].value) {
    return stops[0].rgba
  }

  if (value >= stops[stops.length - 1].value) {
    return stops[stops.length - 1].rgba
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (value <= b.value) {
      const t = (value - a.value) / (b.value - a.value)
      return [
        Math.round(lerp(a.rgba[0], b.rgba[0], t)),
        Math.round(lerp(a.rgba[1], b.rgba[1], t)),
        Math.round(lerp(a.rgba[2], b.rgba[2], t)),
        Math.round(lerp(a.rgba[3], b.rgba[3], t)),
      ]
    }
  }

  return stops[stops.length - 1].rgba
}

/**
 * @param {number} value — wave height in meters
 * @returns {[number, number, number] | null}
 */
export function sampleWaveRgb(value) {
  return lerpRgbStops(WAVE_COLOR_STOPS, value)
}

/**
 * @param {number} value
 * @returns {string}
 */
export function sampleWaveParticleRgba(value) {
  const rgba = lerpRgbaStops(WAVE_PARTICLE_COLOR_STOPS, value)
  return `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})`
}

/**
 * Pre-compute 1024-entry RGBA LUT for overlay rendering.
 * @returns {{ lut: Uint8ClampedArray, min: number, max: number }}
 */
export function buildWaveColorLut() {
  const min = WAVE_COLOR_STOPS[0].value
  const max = WAVE_COLOR_STOPS[WAVE_COLOR_STOPS.length - 1].value
  const lut = new Uint8ClampedArray(WAVE_LUT_SIZE * 4)

  for (let i = 0; i < WAVE_LUT_SIZE; i++) {
    const value = min + (i / (WAVE_LUT_SIZE - 1)) * (max - min)
    const rgb = sampleWaveRgb(value)
    const o = i * 4
    if (!rgb) {
      lut[o] = 0
      lut[o + 1] = 0
      lut[o + 2] = 0
      lut[o + 3] = 0
    } else {
      lut[o] = rgb[0]
      lut[o + 1] = rgb[1]
      lut[o + 2] = rgb[2]
      lut[o + 3] = WAVE_OVERLAY_ALPHA
    }
  }

  return { lut, min, max }
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function valueToWaveLutIndex(value, min, max) {
  if (max <= min) return 0
  const t = (value - min) / (max - min)
  return Math.max(0, Math.min(WAVE_LUT_SIZE - 1, Math.round(t * (WAVE_LUT_SIZE - 1))))
}

/**
 * CSS linear-gradient for the legend bar (bottom = low, top = high).
 * @returns {string}
 */
export function buildWaveLegendGradient() {
  const min = WAVE_COLOR_STOPS[0].value
  const max = WAVE_COLOR_STOPS[WAVE_COLOR_STOPS.length - 1].value
  const range = max - min
  const parts = WAVE_COLOR_STOPS.map(({ value, rgb }) => {
    const pct = ((value - min) / range) * 100
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]}) ${pct.toFixed(1)}%`
  })
  return `linear-gradient(to top, ${parts.join(', ')})`
}
