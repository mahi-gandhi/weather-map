import { GRID_COLS, GRID_ROWS } from './waveStaticGrid.js'

const GRID_SIZE = GRID_COLS * GRID_ROWS
const LAND_THRESHOLD = 80
const OCEAN_FLOOR = 0.3

/**
 * Flood-fill connected zero regions on the wave grid.
 * @param {ArrayLike<number>} data
 * @returns {{ regionId: Int32Array, regionSizes: number[] }}
 */
export function findZeroRegions(data) {
  const visited = new Uint8Array(GRID_SIZE)
  const regionId = new Int32Array(GRID_SIZE).fill(-1)
  const regionSizes = []
  let currentId = 0

  function floodFill(startRow, startCol) {
    const stack = [[startRow, startCol]]
    let size = 0
    while (stack.length) {
      const [row, col] = stack.pop()
      const idx = row * GRID_COLS + col
      if (visited[idx]) continue
      if (data[idx] > 0) continue
      visited[idx] = 1
      regionId[idx] = currentId
      size++
      const neighbors = [
        [row - 1, col],
        [row + 1, col],
        [row, (col - 1 + GRID_COLS) % GRID_COLS],
        [row, (col + 1) % GRID_COLS],
      ]
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr > 180) continue
        const nidx = nr * GRID_COLS + nc
        if (!visited[nidx] && data[nidx] <= 0) {
          stack.push([nr, nc])
        }
      }
    }
    return size
  }

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const idx = row * GRID_COLS + col
      if (!visited[idx] && data[idx] <= 0) {
        regionSizes[currentId] = floodFill(row, col)
        currentId++
      }
    }
  }

  return { regionId, regionSizes }
}

/**
 * Classify zero regions: large contiguous blocks = land, small gaps = ocean.
 * @param {ArrayLike<number>} data
 * @returns {Uint8Array}
 */
export function buildLandMaskFromRegions(data) {
  const { regionId, regionSizes } = findZeroRegions(data)
  const isLand = new Uint8Array(GRID_SIZE)
  for (let i = 0; i < GRID_SIZE; i++) {
    if (data[i] > 0) continue
    const rid = regionId[i]
    if (rid === -1) continue
    isLand[i] = regionSizes[rid] >= LAND_THRESHOLD ? 1 : 0
  }
  return isLand
}

/**
 * Fill small ocean gaps via nearest-neighbor averaging from valid cells.
 * @param {ArrayLike<number>} data
 * @param {Uint8Array} landMask
 * @returns {Float32Array}
 */
export function fillOceanGaps(data, landMask) {
  const filled = Float32Array.from(data)
  const maxIterations = 5

  for (let iter = 0; iter < maxIterations; iter++) {
    let changedAny = false
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const idx = row * GRID_COLS + col
        if (landMask[idx] === 1) continue
        if (filled[idx] > 0) continue

        let sum = 0
        let count = 0
        const neighbors = [
          [row - 1, col],
          [row + 1, col],
          [row, (col - 1 + GRID_COLS) % GRID_COLS],
          [row, (col + 1) % GRID_COLS],
        ]
        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr > 180) continue
          const nidx = nr * GRID_COLS + nc
          if (landMask[nidx] === 0 && filled[nidx] > 0) {
            sum += filled[nidx]
            count++
          }
        }
        if (count > 0) {
          filled[idx] = sum / count
          changedAny = true
        }
      }
    }
    if (!changedAny) break
  }

  for (let i = 0; i < filled.length; i++) {
    if (landMask[i] === 0 && filled[i] <= 0) filled[i] = OCEAN_FLOOR
  }

  return filled
}

/**
 * Infer land mask, fill ocean gaps, and log land coverage for threshold tuning.
 * @param {{ header: object, data: ArrayLike<number> }} rawWaveData
 * @returns {{ header: object, data: Float32Array, landMask: Uint8Array }}
 */
export function processWaveData(rawWaveData) {
  const landMask = buildLandMaskFromRegions(rawWaveData.data)
  let landCount = 0
  for (let i = 0; i < landMask.length; i++) {
    if (landMask[i] === 1) landCount++
  }
  console.log(
    '[wave] inferred land cells:',
    landCount,
    '/65160',
    '(' + Math.round((landCount / GRID_SIZE) * 100) + '%)',
  )

  const filledData = fillOceanGaps(rawWaveData.data, landMask)
  return {
    header: rawWaveData.header,
    data: filledData,
    landMask,
  }
}

/**
 * Bilinear sample with explicit land mask. Returns -1 for land.
 * @param {ArrayLike<number>} data
 * @param {Uint8Array} landMask
 * @param {number} lat
 * @param {number} lng
 * @returns {number}
 */
export function sampleWave(data, landMask, lat, lng) {
  if (lat > 90 || lat < -90) return -1

  const lon = ((lng % 360) + 360) % 360
  const col0 = Math.floor(lon) % GRID_COLS
  const col1 = (col0 + 1) % GRID_COLS
  const row0 = Math.floor(90 - lat)
  const row1 = Math.min(row0 + 1, 180)
  const fx = lon - Math.floor(lon)
  const fy = (90 - lat) - Math.floor(90 - lat)

  if (
    landMask[row0 * GRID_COLS + col0] &&
    landMask[row0 * GRID_COLS + col1] &&
    landMask[row1 * GRID_COLS + col1] &&
    landMask[row1 * GRID_COLS + col0]
  ) {
    return -1
  }

  const v00 = data[row0 * GRID_COLS + col0]
  const v10 = data[row0 * GRID_COLS + col1]
  const v01 = data[row1 * GRID_COLS + col0]
  const v11 = data[row1 * GRID_COLS + col1]

  return (
    v00 * (1 - fx) * (1 - fy) +
    v10 * fx * (1 - fy) +
    v01 * (1 - fx) * fy +
    v11 * fx * fy
  )
}

/**
 * Windy-style wave height color (meters → RGB).
 * @param {number} v
 * @returns {[number, number, number]}
 */
export function waveColor(v) {
  const stops = [
    [0, [20, 10, 60]],
    [0.3, [30, 30, 120]],
    [1.0, [20, 80, 180]],
    [2.0, [0, 160, 180]],
    [3.5, [0, 200, 140]],
    [5.0, [80, 180, 80]],
    [7.0, [140, 80, 180]],
    [10.0, [200, 60, 220]],
  ]

  if (v <= stops[0][0]) return stops[0][1]
  if (v >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]

  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const t = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])
      const a = stops[i - 1][1]
      const b = stops[i][1]
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
      ]
    }
  }

  return stops[stops.length - 1][1]
}
