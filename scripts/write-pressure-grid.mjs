/**
 * Write public/pressure_<date>.json without network (smooth synthetic MSL field).
 * For live data, run: node scripts/generate-pressure-grid.mjs (after rate limit cools down)
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DATE = '2026-06-13'
const NX = 72
const NY = 37
const LON_STEP = 360 / NX
const LAT_STEP = 180 / (NY - 1)

const data = new Array(NX * NY)

for (let row = 0; row < NY; row++) {
  const lat = 90 - row * LAT_STEP
  const latRad = (lat * Math.PI) / 180
  for (let col = 0; col < NX; col++) {
    const lon = -180 + col * LON_STEP
    const lonRad = (lon * Math.PI) / 180
    const p =
      1013 +
      14 * Math.cos(2 * latRad) +
      10 * Math.sin(3 * lonRad + latRad * 0.4) +
      7 * Math.cos(2 * lonRad - latRad * 0.8) +
      5 * Math.sin(latRad * 3.5) * Math.cos(lonRad * 1.5)
    data[row * NX + col] = Math.round(p * 10) / 10
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
writeFileSync(outPath, JSON.stringify([{ header, data }]))
console.log('Wrote', outPath, data.length, 'cells')
