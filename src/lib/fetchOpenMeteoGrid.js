import { LAYERS } from './layers.js'
import { parseOpenMeteoEntries } from './parseOpenMeteoResponse.js'
import { OPEN_METEO_FORECAST, OPEN_METEO_MARINE } from './apiBase.js'
import { loadWaveFile } from './waveStaticGrid.js'

const MARINE_URL = OPEN_METEO_MARINE
const FORECAST_URL = OPEN_METEO_FORECAST

const MARINE_LAYERS = new Set(['ocean_current'])

/** Open-Meteo multi-location GET — stay under URL limits. */
const FORECAST_BATCH_SIZE = 80

const FORECAST_HOURLY = {
  wind: 'wind_speed_10m,wind_direction_10m',
  precipitation: 'precipitation',
  temperature: 'temperature_2m',
}

/**
 * @param {string} layerId
 */
export function isMarineLayer(layerId) {
  return MARINE_LAYERS.has(layerId)
}

/**
 * @param {string} layerId
 * @param {number} lat
 * @param {number} lon
 * @param {number} forecastDays
 */
function buildMarinePointUrl(layerId, lat, lon, forecastDays) {
  if (layerId === 'wave_height') {
    throw new Error('wave_height must use loadWaveFile() — no marine API')
  }

  const time = `forecast_days=${forecastDays}&timezone=UTC`

  if (layerId === 'ocean_current') {
    return `${MARINE_URL}?latitude=${lat}&longitude=${lon}&hourly=ocean_current_velocity,ocean_current_direction&${time}`
  }

  throw new Error(`Not a marine layer: ${layerId}`)
}

/**
 * @param {string} layerId
 * @param {number} lat
 * @param {number} lon
 * @param {number} forecastDays
 */
async function fetchMarinePoint(layerId, lat, lon, forecastDays) {
  const url = buildMarinePointUrl(layerId, lat, lon, forecastDays)
  console.log('[wave] called from:', new Error().stack)
  console.log('[wave] marine API fetch', { layerId, lat, lon, url })
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Open-Meteo marine ${layerId} (${lat},${lon}): HTTP ${res.status} ${text.slice(0, 120)}`,
    )
  }
  return res.json()
}

/**
 * One batched forecast request for many lat/lon pairs (comma-separated).
 * @param {string} layerId
 * @param {{ lat: number, lon: number }[]} points
 * @param {number} forecastDays
 * @param {boolean} preserveAllHours
 */
async function fetchForecastBatch(
  layerId,
  points,
  forecastDays,
  preserveAllHours,
) {
  const latitudes = points.map((p) => p.lat).join(',')
  const longitudes = points.map((p) => p.lon).join(',')
  const hourly = FORECAST_HOURLY[layerId]
  if (!hourly) throw new Error(`No forecast batch URL for layer: ${layerId}`)

  const url =
    `${FORECAST_URL}?latitude=${latitudes}&longitude=${longitudes}` +
    `&hourly=${hourly}&forecast_days=${forecastDays}&timezone=UTC`

  const t0 = performance.now()
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Open-Meteo ${layerId} batch (${points.length} pts): HTTP ${res.status} ${text.slice(0, 200)}`,
    )
  }

  const json = await res.json()
  const entries = parseOpenMeteoEntries(json, points.length, {
    preserveAllHours,
  })
  console.log(
    `[temp] batch OK: ${points.length} points, ${Math.round(performance.now() - t0)}ms`,
  )
  return entries
}

/**
 * Batched forecast API. Temperature uses one request for all points.
 * @param {string} layerId
 * @param {{ lat: number, lon: number }[]} points
 * @param {number} forecastDays
 */
async function fetchBatchedForecastGridEntries(
  layerId,
  points,
  forecastDays,
) {
  const preserveAllHours = forecastDays > 1

  if (layerId === 'temperature' || layerId === 'precipitation') {
    console.log(
      `[fetch] ${layerId} single batched request: ${points.length} points, ${forecastDays} day(s)`,
    )
    const entries = await fetchForecastBatch(
      layerId,
      points,
      forecastDays,
      preserveAllHours,
    )
    while (entries.length < points.length) {
      entries.push(null)
    }
    return entries
  }

  const allEntries = []

  for (let i = 0; i < points.length; i += FORECAST_BATCH_SIZE) {
    const chunk = points.slice(i, i + FORECAST_BATCH_SIZE)
    const entries = await fetchForecastBatch(
      layerId,
      chunk,
      forecastDays,
      preserveAllHours,
    )
    allEntries.push(...entries)
  }

  while (allEntries.length < points.length) {
    allEntries.push(null)
  }

  return allEntries
}

/**
 * @param {string} layerId
 * @param {{ lat: number, lon: number }[]} points
 * @param {number} forecastDays
 * @returns {Promise<(object | null)[] | object[]>}
 */
export async function fetchOpenMeteoGridEntries(layerId, points, forecastDays = 1) {
  console.log('[wave] fetchOpenMeteoGridEntries called', layerId, 'points:', points?.length)
  // Never call marine API for waves — static JSON only
  if (layerId === 'wave_height') {
    console.log('[wave] early exit hit (fetchOpenMeteoGridEntries)')
    await loadWaveFile()
    return []
  }

  if (!LAYERS[layerId]) {
    throw new Error(`Unknown layer: ${layerId}`)
  }

  if (layerId === 'temperature' || layerId === 'precipitation' || layerId === 'wind') {
    return fetchBatchedForecastGridEntries(layerId, points, forecastDays)
  }

  if (layerId === 'ocean_current') {
    return Promise.all(
      points.map(({ lat, lon }) =>
        fetchMarinePoint(layerId, lat, lon, forecastDays),
      ),
    )
  }

  throw new Error(`Unhandled layer in fetchOpenMeteoGridEntries: ${layerId}`)
}

/**
 * @param {{ nx: number, ny: number }} header
 * @returns {number[]}
 */
export function createEmptyScalarGridData(header) {
  return new Array(header.nx * header.ny).fill(NaN)
}
