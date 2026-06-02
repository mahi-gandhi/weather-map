export const TEMPERATURE_LUT_SIZE = 1024
export const TEMPERATURE_LUT_MIN = -65
export const TEMPERATURE_LUT_MAX = 45
export const TEMPERATURE_OVERLAY_ALPHA = 210

/** Windy-style 2 m temperature ramp (°C → RGB). */
export const TEMPERATURE_COLOR_STOPS = [
  { t: -65, r: 130, g: 22, b: 146 },
  { t: -40, r: 130, g: 87, b: 219 },
  { t: -20, r: 32, g: 140, b: 236 },
  { t: -10, r: 32, g: 196, b: 232 },
  { t: 0, r: 35, g: 221, b: 221 },
  { t: 10, r: 194, g: 255, b: 40 },
  { t: 20, r: 255, g: 240, b: 40 },
  { t: 25, r: 255, g: 194, b: 40 },
  { t: 30, r: 252, g: 128, b: 20 },
  { t: 40, r: 255, g: 60, b: 20 },
]

/** @deprecated alias */
export const TEMPERATURE_RENDER_STOPS = TEMPERATURE_COLOR_STOPS.map((s) => ({
  value: s.t,
  rgba: [s.r, s.g, s.b, TEMPERATURE_OVERLAY_ALPHA],
}))

let cachedLut1024 = null

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * @param {number} tempC
 * @param {{ t: number, r: number, g: number, b: number }[]} stops
 * @returns {[number, number, number, number]}
 */
export function sampleTemperatureStops(tempC, stops = TEMPERATURE_COLOR_STOPS) {
  if (tempC == null || Number.isNaN(tempC)) {
    return [0, 0, 0, 0]
  }

  if (tempC <= stops[0].t) {
    const s = stops[0]
    return [s.r, s.g, s.b, TEMPERATURE_OVERLAY_ALPHA]
  }

  const last = stops[stops.length - 1]
  if (tempC >= last.t) {
    return [last.r, last.g, last.b, TEMPERATURE_OVERLAY_ALPHA]
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (tempC <= b.t) {
      const span = b.t - a.t
      const t = span === 0 ? 1 : (tempC - a.t) / span
      return [
        Math.round(lerp(a.r, b.r, t)),
        Math.round(lerp(a.g, b.g, t)),
        Math.round(lerp(a.b, b.b, t)),
        TEMPERATURE_OVERLAY_ALPHA,
      ]
    }
  }

  return [last.r, last.g, last.b, TEMPERATURE_OVERLAY_ALPHA]
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
 * Pre-computed 1024-entry RGBA LUT (-40 °C … 50 °C).
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
  const { lut, min, max, size } = buildTemperatureLut1024()
  const idx = temperatureToLutIndex(tempC, min, max, size)
  const o = idx * 4
  return [lut[o], lut[o + 1], lut[o + 2]]
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
