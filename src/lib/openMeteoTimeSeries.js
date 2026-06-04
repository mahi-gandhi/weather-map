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
  interpolateVectorGrid,
} from './interpolateGrid.js'
import { kmhToKnots, speedDirToUV } from './windToUV.js'
import { fetchOpenMeteoGridEntries } from './fetchOpenMeteoGrid.js'
import { getLayerFetchBounds } from './boundsPad.js'
import { logTemperatureBoundsDebug } from './temperatureCanvasSync.js'
import { loadWaveFile } from './waveStaticGrid.js'

function hourlyAt(entry, key, hourIndex, { missing = 0 } = {}) {
  if (!entry) return missing
  const values = entry?.hourly?.[key]
  if (!values) return missing
  const v = values[hourIndex]
  return v == null ? missing : Number(v)
}

function firstValidEntry(entries) {
  return entries.find((entry) => entry?.hourly?.time?.length) ?? null
}

/**
 * @param {import('leaflet').LatLngBounds} bounds
 * @param {string} layerId
 * @returns {Promise<{ header: object, times: string[], gridsByHour: Array }>}
 */
export async function fetchOpenMeteoTimeSeries(bounds, layerId) {
  // Exit before any marine API call
  if (layerId === 'wave_height') {
    console.log('[wave] early exit hit')
    const grid = await loadWaveFile()
    return {
      header: grid.header,
      times: ['static'],
      gridsByHour: [[grid]],
    }
  }

  const layer = LAYERS[layerId]
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

  console.log(`[fetch] ${layerId} time series (${points.length} points)`)

  let entries
  if (layerId === 'temperature') {
    console.log('[temp] starting time-series grid fetch, points:', points.length)
  }
  try {
    console.log('[wave] openMeteoTimeSeries calling fetchOpenMeteoGridEntries', layerId)
    entries = await fetchOpenMeteoGridEntries(layerId, points, 10)
    if (layerId === 'temperature') {
      console.log('[temp] time-series grid complete, entries:', entries?.length)
    }
  } catch (err) {
    if (layerId === 'temperature') {
      console.error('[temp] time-series grid failed:', err)
    }
    throw err
  }
  const validResults = entries.filter((r) => r != null)

  const times = firstValidEntry(entries)?.hourly?.time ?? []
  const numHours = times.length

  const gridsByHour = []

  for (let h = 0; h < numHours; h++) {
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

        if (layerId === 'ocean_current') {
          const speedKmh = hourlyAt(entry, 'ocean_current_velocity', h)
          const direction = hourlyAt(entry, 'ocean_current_direction', h)
          const speedKn = kmhToKnots(speedKmh)
          const { u, v } = speedDirToUV(speedKn, direction)
          uSamples[row][col] = u
          vSamples[row][col] = v
          speedSamples[row][col] = speedKn
        } else if (layerId === 'wind') {
          const speed = hourlyAt(entry, 'wind_speed_10m', h)
          const direction = hourlyAt(entry, 'wind_direction_10m', h)
          const { u, v } = speedDirToUV(speed, direction)
          uSamples[row][col] = u
          vSamples[row][col] = v
          speedSamples[row][col] = speed
        }
      })

      const { u, v } = interpolateVectorGrid(uSamples, vSamples, header)
      const speed = interpolateScalarGrid(speedSamples, header)
      gridsByHour.push([
        { header, data: u },
        { header, data: v },
        { header, data: speed },
      ])
    } else {
      const samples = createSampleMatrix(sampleSize, 0)
      points.forEach((point, i) => {
        const entry = entries[i]
        const { row, col } = point
        if (entry == null) {
          samples[row][col] = NaN
          return
        }
        if (layerId === 'precipitation') {
          samples[row][col] = hourlyAt(entry, 'precipitation', h)
        } else if (layerId === 'temperature') {
          samples[row][col] = hourlyAt(entry, 'temperature_2m', h, {
            missing: NaN,
          })
        }
      })
      const data = interpolateScalarGrid(samples, header, sampleSize)

      if (layerId === 'temperature') {
        const validPoints = entries.filter((e) => e != null).length
        if (h === 0) console.log('sample count:', validPoints)
        gridsByHour.push([{ header, data, sampleMatrix: samples, sampleSize }])
      } else {
        gridsByHour.push([{ header, data }])
      }
    }
  }

  console.log(`[fetch] ${layerId} time series: ${numHours} hours cached`)

  return { header, times, gridsByHour }
}

/**
 * @param {{ times: string[], gridsByHour: Array }} series
 * @param {Date} forecastTime
 */
export function selectGridsForTime(series, forecastTime) {
  const target = forecastTime.getTime()
  let best = 0
  let bestDiff = Infinity

  for (let i = 0; i < series.times.length; i++) {
    const diff = Math.abs(new Date(series.times[i]).getTime() - target)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }

  return series.gridsByHour[best] ?? series.gridsByHour[0]
}
