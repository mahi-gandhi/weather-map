import { NOMADS_FILTER } from './apiBase.js'
import { padLeafletBounds } from './boundsPad.js'
import { buildSamplePoints, headerFromBounds, createSampleMatrix } from './sampleGrid.js'
import { parseGrib2WindBuffer } from './parseGrib2.js'
import {
  fetchDenseOpenMeteoGrid,
  samplesToFloatGrid,
  KMH_TO_MS,
} from './fetchDenseOpenMeteo.js'
import { speedDirToUV } from './windToUV.js'

const DENSE_FALLBACK_SIZE = 20
import { WIND_TEXTURE_NX, WIND_TEXTURE_NY } from './encodeWindTexture.js'

/**
 * Latest GFS cycle (00/06/12/18Z), 3-hour steps.
 */
function latestGfsCycle() {
  const now = new Date()
  const cycleHour = Math.floor(now.getUTCHours() / 6) * 6
  const cycle = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      cycleHour,
      0,
      0,
    ),
  )
  if (cycle > now) cycle.setUTCHours(cycle.getUTCHours() - 6)

  const y = cycle.getUTCFullYear()
  const m = String(cycle.getUTCMonth() + 1).padStart(2, '0')
  const d = String(cycle.getUTCDate()).padStart(2, '0')
  const hh = String(cycle.getUTCHours()).padStart(2, '0')

  return {
    date: `${y}${m}${d}`,
    hour: hh,
  }
}

/**
 * @param {object} bounds
 */
function buildNomadsUrl(bounds) {
  const north = bounds.getNorth()
  const south = bounds.getSouth()
  const west = bounds.getWest()
  const east = bounds.getEast()
  const { date, hour } = latestGfsCycle()

  const params = new URLSearchParams({
    dir: `/gfs.${date}/${hour}/atmos`,
    file: `gfs.t${hour}z.pgrb2.0p25.f000`,
    var_UGRD: 'on',
    var_VGRD: 'on',
    var_TMP: 'on',
    lev_10_m_above_ground: 'on',
    lev_2_m_above_ground: 'on',
    subregion: '',
    leftlon: String(west),
    rightlon: String(east),
    toplat: String(north),
    bottomlat: String(south),
  })

  return `${NOMADS_FILTER}?${params.toString()}`
}

/**
 * @param {object} bounds
 */
async function fetchNomadsGrib2(bounds) {
  const url = buildNomadsUrl(bounds)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`NOMADS HTTP ${res.status}`)
  }
  const buf = await res.arrayBuffer()
  if (buf.byteLength < 1024) {
    throw new Error('NOMADS response too small')
  }
  return buf
}

/**
 * @param {object} bounds
 */
async function fetchOpenMeteoDenseWind(bounds) {
  const { header, entries, gridSize } = await fetchDenseOpenMeteoGrid(
    bounds,
    DENSE_FALLBACK_SIZE,
    ['wind_speed_10m', 'wind_direction_10m'],
  )

  const points = buildSamplePoints(bounds, gridSize)
  const uSamples = createSampleMatrix(gridSize, NaN)
  const vSamples = createSampleMatrix(gridSize, NaN)

  points.forEach((point, i) => {
    const { row, col } = point
    const entry = entries[i]
    if (!entry?.hourly) {
      uSamples[row][col] = NaN
      vSamples[row][col] = NaN
      return
    }
    const speedKmh = entry.hourly.wind_speed_10m?.[0] ?? 0
    const direction = entry.hourly.wind_direction_10m?.[0] ?? 0
    const speedMs = speedKmh * KMH_TO_MS
    const { u, v } = speedDirToUV(speedMs, direction)
    uSamples[row][col] = u
    vSamples[row][col] = v
  })

  const u = samplesToFloatGrid(uSamples, gridSize, header)
  const v = samplesToFloatGrid(vSamples, gridSize, header)

  return {
    source: 'openmeteo',
    header,
    u,
    v,
    nx: gridSize,
    ny: gridSize,
    textureWidth: WIND_TEXTURE_NX,
    textureHeight: WIND_TEXTURE_NY,
  }
}

/**
 * Resample parsed GFS grid to uniform header dimensions.
 */
function packGfsResult(parsed, bounds) {
  const header = headerFromBounds(bounds, parsed.nx, parsed.ny)
  return {
    source: 'gfs',
    header,
    u: parsed.u,
    v: parsed.v,
    nx: parsed.nx,
    ny: parsed.ny,
    textureWidth: WIND_TEXTURE_NX,
    textureHeight: WIND_TEXTURE_NY,
  }
}

/**
 * Fetch gridded wind (GFS via NOMADS, Open-Meteo 20×20 fallback).
 * @param {import('leaflet').LatLngBounds} visibleBounds
 */
export async function fetchGFSGrid(visibleBounds) {
  const fetchBounds = padLeafletBounds(visibleBounds, 0.15)

  try {
    const buffer = await fetchNomadsGrib2(fetchBounds)
    const parsed = parseGrib2WindBuffer(buffer)
    if (parsed?.u?.length && parsed?.v?.length) {
      console.info('[fetchGFS] NOMADS GRIB2 wind grid', parsed.nx, '×', parsed.ny)
      return packGfsResult(parsed, fetchBounds)
    }
    console.warn('[fetchGFS] GRIB2 parse returned no wind fields')
  } catch (err) {
    console.warn('[fetchGFS] NOMADS failed — Open-Meteo dense fallback', err)
  }

  const fallback = await fetchOpenMeteoDenseWind(fetchBounds)
  console.info(
    `[fetchGFS] Open-Meteo dense grid ${fallback.nx}×${fallback.ny}`,
  )
  return fallback
}

/**
 * @param {{ header: object, u: Float32Array, v: Float32Array }} grid
 * @returns {Array<{ header: object, data: Float32Array | number[] }>}
 */
export function gfsGridToLayerGrids(grid) {
  const { header, u, v } = grid
  const speed = new Float32Array(u.length)
  for (let i = 0; i < u.length; i++) {
    speed[i] = Math.hypot(u[i], v[i]) * 3.6
  }

  return [
    { header, data: u },
    { header, data: v },
    { header, data: speed },
  ]
}

export { WIND_TEXTURE_NX, WIND_TEXTURE_NY, DENSE_FALLBACK_SIZE }
