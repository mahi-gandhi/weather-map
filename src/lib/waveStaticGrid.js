const GRID_COLS = 360
const GRID_ROWS = 181

let waveFilePromise = null

/**
 * Load static global wave grid from public/wave_2019-11-27_00.json
 * @returns {Promise<{ header: object, data: number[] }>}
 */
export async function loadWaveFile() {
  if (!waveFilePromise) {
    waveFilePromise = (async () => {
      const base = import.meta.env.BASE_URL
      const url = `${base}wave_2019-11-27_00.json`
      console.log('[wave] loading from:', url)
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to load wave JSON')
      const raw = await res.json()
      const item = raw[0]
      if (!item?.header || !Array.isArray(item?.data)) {
        throw new Error('Invalid static wave grid format')
      }
      return item
    })().catch((err) => {
      waveFilePromise = null
      throw err
    })
  }
  return waveFilePromise
}

/** @deprecated Use loadWaveFile */
export const fetchStaticWaveGrid = loadWaveFile

/**
 * Sample global 1° wave grid (360×181, lon 0–359, lat 90→−90).
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @returns {number | null}
 */
export function sampleGlobalWaveAt(lat, lng, data) {
  if (lat > 90 || lat < -90) return null

  const lon = ((lng % 360) + 360) % 360
  const col = Math.floor(lon)
  const row = Math.floor(90 - lat)

  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null

  const value = data[row * GRID_COLS + col]
  if (value == null || Number.isNaN(value) || value === 0) return null

  return value
}
