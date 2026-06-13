/**
 * One-off script: fetch global MSL pressure on a 5° grid and write public/pressure_<date>.json
 * Usage: node scripts/generate-pressure-grid.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DATE = '2026-06-13'
const NX = 36
const NY = 19
const LON_STEP = 360 / NX
const LAT_STEP = 180 / (NY - 1)
const BATCH_SIZE = 40
const BATCH_DELAY_MS = 2500
const API = 'https://api.open-meteo.com/v1/forecast'

const points = []
for (let row = 0; row < NY; row++) {
  const lat = 90 - row * LAT_STEP
  for (let col = 0; col < NX; col++) {
    const lon = -180 + col * LON_STEP
    points.push({ lat, lon, row, col })
  }
}

async function fetchBatch(batch) {
  const latitudes = batch.map((p) => p.lat.toFixed(2)).join(',')
  const longitudes = batch.map((p) => p.lon.toFixed(2)).join(',')
  const url =
    `${API}?latitude=${latitudes}&longitude=${longitudes}` +
    '&hourly=pressure_msl&forecast_days=1&timezone=UTC'

  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  return res.json()
}

function parseEntries(json, count) {
  if (Array.isArray(json)) return json
  if (json?.hourly) return [json]
  return []
}

const data = new Array(NX * NY).fill(NaN)

for (let i = 0; i < points.length; i += BATCH_SIZE) {
  const batch = points.slice(i, i + BATCH_SIZE)
  process.stdout.write(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(points.length / BATCH_SIZE)}… `)
  const json = await fetchBatch(batch)
  const entries = parseEntries(json, batch.length)

  batch.forEach((p, j) => {
    const entry = entries[j] ?? entries[0]
    const values = entry?.hourly?.pressure_msl
    const v = values?.[0]
    if (v != null && !Number.isNaN(v)) {
      data[p.row * NX + p.col] = Math.round(v * 10) / 10
    }
  })
  console.log('ok')
  if (i + BATCH_SIZE < points.length) {
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS))
  }
}

const header = {
  nx: NX,
  ny: NY,
  lo1: -180,
  lo2: -180 + (NX - 1) * LON_STEP,
  la1: 90,
  la2: -90,
  dx: LON_STEP,
  dy: LAT_STEP,
  parameter: 'pressure_msl',
  unit: 'hPa',
  refTime: `${OUT_DATE}T00:00:00Z`,
}

const outPath = join(__dirname, '..', 'public', `pressure_${OUT_DATE}.json`)
const payload = [{ header, data }]
writeFileSync(outPath, JSON.stringify(payload))
console.log('Wrote', outPath, `(${data.filter(Number.isFinite).length}/${data.length} valid cells)`)
