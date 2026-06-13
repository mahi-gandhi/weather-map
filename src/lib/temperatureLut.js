export const TEMPERATURE_LUT_SIZE = 1024
export const TEMPERATURE_LUT_MIN = -30
export const TEMPERATURE_LUT_MAX = 45
export const TEMPERATURE_OVERLAY_ALPHA = 210

/** Purple/blue (cold) → pink/red (hot), matching wave layer palette. */
const TEMP_COLOR_STOPS = [
  [-30, [40, 20, 90]],
  [-15, [70, 40, 140]],
  [0, [90, 90, 200]],
  [10, [80, 140, 220]],
  [20, [200, 140, 220]],
  [28, [240, 100, 160]],
  [35, [240, 60, 100]],
  [45, [220, 30, 60]],
]

/** @deprecated alias — derived from {@link tempColor} stops */
export const TEMPERATURE_COLOR_STOPS = TEMP_COLOR_STOPS.map(([t, [r, g, b]]) => ({
  t,
  r,
  g,
  b,
}))

/** @deprecated alias */
export const TEMPERATURE_RENDER_STOPS = TEMPERATURE_COLOR_STOPS.map((s) => ({
  value: s.t,
  rgba: [s.r, s.g, s.b, TEMPERATURE_OVERLAY_ALPHA],
}))

let cachedLut1024 = null

/**
 * @param {number} tempC — typically -30 to 45 °C
 * @returns {[number, number, number]}
 */
export function tempColor(tempC) {
  const stops = TEMP_COLOR_STOPS

  if (tempC <= stops[0][0]) return stops[0][1]
  if (tempC >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]

  for (let i = 1; i < stops.length; i++) {
    if (tempC <= stops[i][0]) {
      const t = (tempC - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])
      const a = stops[i - 1][1]
      const b = stops[i][1]
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
      ]
    }
  }

  return stops[stops.length - 1][1]
}

/**
 * @param {number} tempC
 * @returns {[number, number, number, number]}
 */
export function sampleTemperatureStops(tempC) {
  if (tempC == null || Number.isNaN(tempC)) {
    return [0, 0, 0, 0]
  }

  const [r, g, b] = tempColor(tempC)
  return [r, g, b, TEMPERATURE_OVERLAY_ALPHA]
}

/**
 * @param {number} tempC
 * @param {number} [min]
 * @param {number} [max]
 * @param {number} [size]
 * @returns {number}
 */
export function temperatureToLutIndex(
  tempC,
  min = TEMPERATURE_LUT_MIN,
  max = TEMPERATURE_LUT_MAX,
  size = TEMPERATURE_LUT_SIZE,
) {
  const t = (tempC - min) / (max - min || 1)
  const clamped = Math.max(0, Math.min(1, t))
  return Math.floor(clamped * (size - 1))
}

/**
 * Pre-computed 1024-entry RGBA LUT (-30 °C … 45 °C).
 * @returns {{ lut: Float32Array, min: number, max: number, size: number }}
 */
export function buildTemperatureLut1024() {
  if (cachedLut1024) return cachedLut1024

  const lut = new Float32Array(TEMPERATURE_LUT_SIZE * 4)
  const min = TEMPERATURE_LUT_MIN
  const max = TEMPERATURE_LUT_MAX
  const span = max - min

  for (let i = 0; i < TEMPERATURE_LUT_SIZE; i++) {
    const temp = min + (i / (TEMPERATURE_LUT_SIZE - 1)) * span
    const [r, g, b, a] = sampleTemperatureStops(temp)
    const o = i * 4
    lut[o] = r
    lut[o + 1] = g
    lut[o + 2] = b
    lut[o + 3] = a
  }

  cachedLut1024 = {
    lut,
    min,
    max,
    size: TEMPERATURE_LUT_SIZE,
  }
  return cachedLut1024
}

/**
 * @param {number} tempC
 * @returns {[number, number, number]}
 */
export function sampleTemperatureRgb(tempC) {
  return tempColor(tempC)
}

/**
 * CSS linear-gradient for the legend bar (bottom = cold, top = hot).
 * @returns {string}
 */
export function buildTemperatureLegendGradient() {
  const min = TEMP_COLOR_STOPS[0][0]
  const max = TEMP_COLOR_STOPS[TEMP_COLOR_STOPS.length - 1][0]
  const range = max - min
  const parts = TEMP_COLOR_STOPS.map(([value, rgb]) => {
    const pct = ((value - min) / range) * 100
    return `rgb(${rgb[0]},${rgb[1]},${rgb[2]}) ${pct.toFixed(1)}%`
  })
  return `linear-gradient(to top, ${parts.join(', ')})`
}

/**
 * @param {ArrayLike<number>} lut
 */
export function logTemperatureLutSelfTest(lut) {
  const testTemp = 35
  const idx = temperatureToLutIndex(testTemp)
  console.log(
    '[temp] 35°C maps to LUT index:',
    idx,
    'color:',
    lut[idx * 4],
    lut[idx * 4 + 1],
    lut[idx * 4 + 2],
  )
}

/**
 * @param {number[][]} sampleMatrix
 * @param {ArrayLike<number>} lut
 * @param {number} lutMin
 * @param {number} lutMax
 */
export function logTemperatureRenderDebug(
  sampleMatrix,
  lut,
  lutMin = TEMPERATURE_LUT_MIN,
  lutMax = TEMPERATURE_LUT_MAX,
) {
  const flat = sampleMatrix
    .flat()
    .filter((v) => v != null && !Number.isNaN(v))

  const minTemp = flat.length ? Math.min(...flat) : NaN
  const maxTemp = flat.length ? Math.max(...flat) : NaN

  console.log('[temp] min temp:', minTemp, 'max temp:', maxTemp)
  console.log(
    '[temp] sample values:',
    flat.slice(0, 10),
  )
  logTemperatureLutSelfTest(lut)
}

/** @deprecated Use buildTemperatureLut1024 */
export function getTemperatureLut512() {
  return buildTemperatureLut1024()
}
