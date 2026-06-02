import { OPEN_METEO_FORECAST } from './apiBase.js'
import { buildSamplePoints, headerFromBounds, createSampleMatrix } from './sampleGrid.js'
import { bilinearSampleSparse } from './interpolateGrid.js'

const KMH_TO_MS = 1 / 3.6

/**
 * Dense forecast grid via Open-Meteo (per-point, allSettled).
 * @param {object} bounds — duck-typed Leaflet bounds
 * @param {number} gridSize
 * @param {string[]} hourlyParams
 */
export async function fetchDenseOpenMeteoGrid(
  bounds,
  gridSize,
  hourlyParams,
) {
  const points = buildSamplePoints(bounds, gridSize)
  const header = headerFromBounds(bounds, gridSize, gridSize)

  const settled = await Promise.allSettled(
    points.map(async ({ lat, lon }) => {
      const params = hourlyParams.join(',')
      const url =
        `${OPEN_METEO_FORECAST}?latitude=${lat}&longitude=${lon}` +
        `&hourly=${params}&forecast_days=1&timezone=UTC`
      const res = await fetch(url)
      if (!res.ok) return null
      return res.json()
    }),
  )

  const entries = settled.map((r) =>
    r.status === 'fulfilled' ? r.value : null,
  )

  return { header, points, entries, gridSize }
}

/**
 * @param {number[][]} samples
 * @param {number} gridSize
 * @param {object} header
 */
export function samplesToFloatGrid(samples, gridSize, header) {
  const nx = gridSize
  const ny = gridSize
  const data = new Float32Array(nx * ny)
  const latSpan = Math.max(header.la1, header.la2) - Math.min(header.la1, header.la2)
  const lonSpan = Math.max(header.lo2, header.lo1) - Math.min(header.lo2, header.lo1)
  const maxIndex = gridSize - 1

  for (let row = 0; row < ny; row++) {
    const lat = header.la1 - row * header.dy
    const ty = latSpan === 0 ? 0 : ((header.la1 - lat) / latSpan) * maxIndex
    for (let col = 0; col < nx; col++) {
      const lon = header.lo1 + col * header.dx
      const tx = lonSpan === 0 ? 0 : ((lon - header.lo1) / lonSpan) * maxIndex
      const v = bilinearSampleSparse(samples, tx, ty, gridSize)
      data[row * nx + col] = v == null || Number.isNaN(v) ? 0 : v
    }
  }

  return data
}

export { KMH_TO_MS }
