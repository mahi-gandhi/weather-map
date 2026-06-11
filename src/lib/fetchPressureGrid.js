import { OPEN_METEO_FORECAST } from './apiBase.js'
import { buildSamplePoints, headerFromBounds } from './sampleGrid.js'
import { parseOpenMeteoEntries } from './parseOpenMeteoResponse.js'

const PRESSURE_GRID_SIZE = 8

/**
 * Fetch mean sea level pressure for an 8×8 grid over bounds (batched).
 * @param {import('leaflet').LatLngBounds} bounds
 * @returns {Promise<{ header: object, samples: number[][], gridSize: number }>}
 */
export async function fetchPressureGrid(bounds) {
  const points = buildSamplePoints(bounds, PRESSURE_GRID_SIZE)
  const header = headerFromBounds(bounds)
  const latitudes = points.map((p) => p.lat).join(',')
  const longitudes = points.map((p) => p.lon).join(',')

  const url =
    `${OPEN_METEO_FORECAST}?latitude=${latitudes}&longitude=${longitudes}` +
    '&hourly=pressure_msl&forecast_days=1&timezone=UTC'

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Pressure grid HTTP ${res.status}`)
  }

  const json = await res.json()
  const entries = parseOpenMeteoEntries(json, points.length, {
    preserveAllHours: false,
  })

  const samples = Array.from({ length: PRESSURE_GRID_SIZE }, () =>
    Array(PRESSURE_GRID_SIZE).fill(NaN),
  )
  for (let i = 0; i < points.length; i++) {
    const { row, col } = points[i]
    const entry = entries[i]
    const values = entry?.hourly?.pressure_msl
    samples[row][col] = values?.[0] ?? NaN
  }

  return { header, samples, gridSize: PRESSURE_GRID_SIZE }
}
