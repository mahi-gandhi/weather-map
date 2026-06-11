export const GRID_COLS = 360
export const GRID_ROWS = 181

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
 * Normalize longitude to 0–359 grid index space.
 * @param {number} lng
 * @returns {number}
 */
export function normalizeWaveLongitude(lng) {
  return ((lng % 360) + 360) % 360
}

/**
 * Raw grid sample (0 on land/missing).
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @returns {number}
 */
export function sampleGlobalWaveRaw(lat, lng, data) {
  if (lat > 90 || lat < -90) return 0

  const lonF = normalizeWaveLongitude(lng)
  const col0 = Math.floor(lonF)
  const col1 = (col0 + 1) % GRID_COLS
  const tx = lonF - col0

  const latF = 90 - lat
  const row0 = Math.max(0, Math.floor(latF))
  const row1 = Math.min(180, row0 + 1)
  const ty = latF - row0

  const v00 = data[row0 * GRID_COLS + col0] || 0
  const v10 = data[row0 * GRID_COLS + col1] || 0
  const v01 = data[row1 * GRID_COLS + col0] || 0
  const v11 = data[row1 * GRID_COLS + col1] || 0

  let value = 0
  let weight = 0
  if (v00 > 0) {
    value += v00 * (1 - tx) * (1 - ty)
    weight += (1 - tx) * (1 - ty)
  }
  if (v10 > 0) {
    value += v10 * tx * (1 - ty)
    weight += tx * (1 - ty)
  }
  if (v01 > 0) {
    value += v01 * (1 - tx) * ty
    weight += (1 - tx) * ty
  }
  if (v11 > 0) {
    value += v11 * tx * ty
    weight += tx * ty
  }

  if (weight > 0.3) return value / weight
  return 0
}

/**
 * Nearest-cell ocean mask (wave data > 0.05 = ocean).
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @returns {boolean}
 */
export function isOcean(lat, lng, data) {
  if (lat > 85 || lat < -85) return false
  const lon = ((lng % 360) + 360) % 360
  const col = Math.floor(lon)
  const row = Math.floor(90 - lat)
  if (row < 0 || row > 180 || col < 0 || col >= GRID_COLS) return false
  return (data[row * GRID_COLS + col] ?? 0) > 0.05
}

/**
 * Nearest-neighbor sample on global 1° grid.
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @returns {number | null}
 */
export function sampleGlobalWaveAt(lat, lng, data) {
  if (lat > 90 || lat < -90) return null

  const lon = normalizeWaveLongitude(lng)
  const col = Math.floor(lon)
  const row = Math.floor(90 - lat)

  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null

  const value = data[row * GRID_COLS + col]
  if (value == null || Number.isNaN(value) || value === 0) return null

  return value
}

/**
 * Bilinear sample with weighted non-zero corners (coastline-aware).
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @returns {number | null}
 */
export function sampleGlobalWaveBilinear(lat, lng, data) {
  const value = sampleGlobalWaveRaw(lat, lng, data)
  if (value <= 0.05) return null
  return value
}

/**
 * Wave height gradient for swell direction (height decreases downhill).
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @returns {{ dx: number, dy: number, value: number }}
 */
export function sampleGlobalWaveGradient(lat, lng, data) {
  const value = sampleGlobalWaveRaw(lat, lng, data)
  const dx =
    sampleGlobalWaveRaw(lat, lng + 1, data) -
    sampleGlobalWaveRaw(lat, lng - 1, data)
  const dy =
    sampleGlobalWaveRaw(lat + 1, lng, data) -
    sampleGlobalWaveRaw(lat - 1, lng, data)
  return { dx, dy, value }
}
