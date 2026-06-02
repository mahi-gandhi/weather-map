import { LAYERS } from './layers.js'
import {
  buildSamplePoints,
  headerFromBounds,
  SAMPLE_SIZE,
  getSampleSizeForLayer,
  createSampleMatrix,
} from './sampleGrid.js'
import {
  interpolateScalarGrid,
  interpolateScalarGridSparse,
  interpolateVectorGrid,
} from './interpolateGrid.js'
import { kmhToKnots, speedDirToUV } from './windToUV.js'
import { encodeWindSpeedKmhPng } from './encodeWindPng.js'
import {
  fetchOpenMeteoTimeSeries,
  selectGridsForTime,
} from './openMeteoTimeSeries.js'
import {
  createEmptyScalarGridData,
  fetchOpenMeteoGridEntries,
} from './fetchOpenMeteoGrid.js'
import { getLayerFetchBounds } from './boundsPad.js'
import { logTemperatureBoundsDebug } from './temperatureCanvasSync.js'
import { fetchGFSGrid, gfsGridToLayerGrids } from './fetchGFSGrid.js'

const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

const SERIES_LAYERS = new Set([
  'wave_height',
  'precipitation',
  'ocean_current',
  'temperature',
])

/**
 * @param {string} layerId
 * @param {import('leaflet').LatLngBounds} bounds
 * @param {{ forecastTime?: Date, timeSeriesCache?: Map<string, object> }} [options]
 * @returns {Promise<Array<{ header: object, data: number[] }>>}
 */
export async function fetchLayerGrid(layerId, bounds, options = {}) {
  const { forecastTime, timeSeriesCache } = options
  const layer = LAYERS[layerId]
  if (!layer) throw new Error(`Unknown layer: ${layerId}`)

  if (layerId === 'wind') {
    console.log('[fetch] wind GFS / dense grid')
    const gfs = await fetchGFSGrid(bounds)
    const grids = gfsGridToLayerGrids(gfs)
    grids.gfsMeta = gfs
    grids.dataSource = gfs.source
    return grids
  }

  if (SERIES_LAYERS.has(layerId) && timeSeriesCache) {
    const cacheKey = boundsCacheKey(layerId, bounds)
    let series = timeSeriesCache.get(cacheKey)
    if (!series) {
      if (layerId === 'temperature') {
        console.log('[temp] starting time-series fetch, bounds:', {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        })
      }
      try {
        series = await fetchOpenMeteoTimeSeries(bounds, layerId)
        if (layerId === 'temperature') {
          console.log('[temp] time-series fetch complete, hours:', series?.times?.length)
        }
      } catch (err) {
        if (layerId === 'temperature') {
          console.error('[temp] time-series fetch failed:', err)
        }
        throw err
      }
      timeSeriesCache.set(cacheKey, series)
    }
    if (forecastTime) {
      const grids = selectGridsForTime(series, forecastTime)
      if (layerId === 'wind') attachWindPngUrl(grids)
      return grids
    }
  }

  const fetchBounds = getLayerFetchBounds(layerId, bounds)
  const sampleSize = getSampleSizeForLayer(layerId)
  const points = buildSamplePoints(fetchBounds, sampleSize)
  const header = headerFromBounds(fetchBounds)

  if (layerId === 'temperature') {
    logTemperatureBoundsDebug(bounds, fetchBounds, {
      gridWidth: sampleSize,
      gridHeight: sampleSize,
    })
  }

  console.log(`[fetch] ${layerId} grid (${points.length} points)`)

  if (layerId === 'temperature') {
    console.log('[temp] starting fetch, bounds:', {
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    })
  }

  let entries
  try {
    entries = await fetchOpenMeteoGridEntries(layerId, points, 1)
    if (layerId === 'temperature') {
      console.log('[temp] fetch complete, points:', entries?.length)
    }
  } catch (err) {
    if (layerId === 'temperature') {
      console.error('[temp] fetch failed:', err)
    }
    throw err
  }
  const validResults = entries.filter((r) => r != null)
  console.log(
    `[fetch] ${layerId} ${validResults.length}/${points.length} valid sample points`,
  )

  if (layerId === 'wave_height' && validResults.length === 0) {
    console.warn('[fetch] wave_height: no valid marine points — empty grid')
    return [{ header, data: createEmptyScalarGridData(header) }]
  }

  if (entries.length !== points.length) {
    console.warn(
      `[fetch] ${layerId} location count mismatch — interpolation may be wrong`,
    )
  }

  if (layer.type === 'vector' || layer.type === 'current') {
    const uSamples = Array.from({ length: SAMPLE_SIZE }, () =>
      Array(SAMPLE_SIZE).fill(0),
    )
    const vSamples = Array.from({ length: SAMPLE_SIZE }, () =>
      Array(SAMPLE_SIZE).fill(0),
    )
    const speedSamples = Array.from({ length: SAMPLE_SIZE }, () =>
      Array(SAMPLE_SIZE).fill(0),
    )

    points.forEach((point, i) => {
      const entry = entries[i] ?? entries[0]
      const { row, col } = point
      const { u, v, speed } = extractVector(layerId, entry)
      uSamples[row][col] = u
      vSamples[row][col] = v
      speedSamples[row][col] = speed
    })

    const { u, v } = interpolateVectorGrid(uSamples, vSamples, header)
    const speed = interpolateScalarGrid(speedSamples, header)

    const grids = [
      { header, data: u },
      { header, data: v },
      { header, data: speed },
    ]
    if (layerId === 'wind') attachWindPngUrl(grids)
    return grids
  }

  const samples = createSampleMatrix(sampleSize, NaN)
  const sparseScalar = layerId === 'wave_height'

  points.forEach((point, i) => {
    const entry = entries[i]
    const { row, col } = point
    if (entry == null) {
      samples[row][col] = NaN
      return
    }
    samples[row][col] = extractScalar(layerId, entry)
  })

  if (layerId === 'wave_height' || layerId === 'precipitation') {
    console.log(`[fetch] ${layerId} ${sampleSize}×${sampleSize} samples:`, samples)
  }

  const data = sparseScalar
    ? interpolateScalarGridSparse(samples, header, sampleSize)
    : interpolateScalarGrid(samples, header, sampleSize)

  if (layerId === 'wave_height' || layerId === 'precipitation') {
    logSampleStats(layerId, data)
  }

  if (layerId === 'temperature') {
    const validPoints = validResults.length
    console.log('sample count:', validPoints)
    return [{ header, data, sampleMatrix: samples, sampleSize }]
  }

  return [{ header, data }]
}

/**
 * @param {Array<{ header: object, data: number[] }>} grids
 */
function attachWindPngUrl(grids) {
  const header = grids[0].header
  const speed =
    grids[2]?.data ??
    grids[0].data.map((u, i) => Math.hypot(u, grids[1].data[i]))
  const { pngUrl } = encodeWindSpeedKmhPng(speed, header)
  grids.pngUrl = pngUrl
  return grids
}

function boundsCacheKey(layerId, bounds) {
  return [
    layerId,
    bounds.getSouth().toFixed(2),
    bounds.getNorth().toFixed(2),
    bounds.getWest().toFixed(2),
    bounds.getEast().toFixed(2),
  ].join('|')
}

function logSampleStats(layerId, data) {
  const valid = data.filter((v) => v != null && !Number.isNaN(v))
  const max = valid.length ? Math.max(...valid) : 0
  const min = valid.length ? Math.min(...valid) : 0
  const ocean = valid.filter((v) =>
    layerId === 'wave_height' ? v > 0.1 : v > 0.01,
  ).length
  console.log(`[fetch] ${layerId} grid range:`, { min, max, oceanCells: ocean })
}

function hourlyFirst(entry, key) {
  const values = entry?.hourly?.[key]
  if (values == null) return null
  if (Array.isArray(values)) {
    const v = values[0]
    return v == null ? null : Number(v)
  }
  return Number(values)
}

function extractScalar(layerId, entry) {
  if (!entry) return NaN
  if (entry?.error) {
    console.warn(`[fetch] ${layerId} point error`, entry)
    return layerId === 'wave_height' ? NaN : 0
  }

  if (layerId === 'wave_height') {
    return hourlyFirst(entry, 'significant_wave_height') ?? NaN
  }
  if (layerId === 'precipitation') {
    return hourlyFirst(entry, 'precipitation') ?? 0
  }
  if (layerId === 'temperature') {
    return hourlyFirst(entry, 'temperature_2m') ?? NaN
  }
  return 0
}

function extractVector(layerId, entry) {
  if (entry?.error) {
    return { u: 0, v: 0, speed: 0 }
  }

  if (layerId === 'wind') {
    const speed = hourlyFirst(entry, 'wind_speed_10m') ?? 0
    const direction = hourlyFirst(entry, 'wind_direction_10m') ?? 0
    const { u, v } = speedDirToUV(speed, direction)
    return { u, v, speed }
  }

  if (layerId === 'ocean_current') {
    const speedKmh = hourlyFirst(entry, 'ocean_current_velocity') ?? 0
    const direction = hourlyFirst(entry, 'ocean_current_direction') ?? 0
    const speedKn = kmhToKnots(speedKmh)
    const { u, v } = speedDirToUV(speedKn, direction)
    return { u, v, speed: speedKn }
  }

  return { u: 0, v: 0, speed: 0 }
}

/**
 * Forecast for map click popup (Open-Meteo forecast API).
 * @param {number} lat
 * @param {number} lng
 */
async function fetchMarineWavePoint(lat, lng) {
  const url =
    `${MARINE_URL}?latitude=${lat}&longitude=${lng}` +
    '&hourly=significant_wave_height&forecast_days=1&timezone=UTC'
  const res = await fetch(url).catch(() => null)
  if (!res || !res.ok) return null
  try {
    const json = await res.json()
    return json?.hourly?.significant_wave_height?.[0] ?? null
  } catch {
    return null
  }
}

export async function fetchPointForecast(lat, lng) {
  const forecastUrl =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lng}` +
    '&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,precipitation' +
    '&forecast_days=7&timezone=UTC'

  const [res, waveHeight] = await Promise.all([
    fetch(forecastUrl).catch(() => null),
    fetchMarineWavePoint(lat, lng),
  ])

  if (!res || !res.ok) {
    throw new Error(`Forecast HTTP ${res?.status ?? 'network'}`)
  }

  const json = await res.json().catch(() => null)
  if (!json || json.error) {
    throw new Error(json?.reason || json?.error || 'Invalid forecast response')
  }

  const times = json.hourly?.time ?? []
  const temperature = json.hourly?.temperature_2m ?? []
  const wind = json.hourly?.wind_speed_10m ?? []
  const windDir = json.hourly?.wind_direction_10m ?? []
  const precip = json.hourly?.precipitation ?? []

  const hourly48 = times.slice(0, 48).map((time, i) => ({
    time,
    label: formatForecastTick(time),
    temperature: temperature[i] ?? null,
    precipitation: precip[i] ?? null,
  }))

  return {
    hourly: hourly48,
    temperature: temperature[0] ?? null,
    wind: wind[0] ?? null,
    windDirection: windDir[0] ?? null,
    precipitation: precip[0] ?? null,
    waveHeight,
  }
}

function formatForecastTick(iso) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })
  const hour = String(d.getUTCHours()).padStart(2, '0')
  return `${day} ${hour}h`
}

/**
 * @param {Array<{ header: object, data: number[] }>} grids
 * @returns {number[] | null}
 */
export function getScalarData(grids) {
  if (!grids?.length) return null
  return grids[0].data
}

/**
 * @param {Array<{ header: object, data: number[] }>} grids
 * @returns {{ u: number[], v: number[] } | null}
 */
export function getVectorData(grids) {
  if (!grids || grids.length < 2) return null
  return { u: grids[0].data, v: grids[1].data }
}

/**
 * Speed grid for ocean-current masking (knots).
 * @param {Array<{ header: object, data: number[] }>} grids
 */
export function getSpeedData(grids) {
  if (!grids || grids.length < 3) return null
  return grids[2].data
}
