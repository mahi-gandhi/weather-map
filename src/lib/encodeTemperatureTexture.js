import {
  TEMPERATURE_LUT_MAX,
  TEMPERATURE_LUT_MIN,
} from './temperatureLut.js'

/**
 * Pack 15×15 (or N×N) temperature samples into RGBA for GPU bilinear sampling.
 * R = normalized temperature, A = 255 when valid else 0.
 * @param {number[][]} sampleMatrix
 * @param {number} gridSize
 * @param {number} [tempMin]
 * @param {number} [tempMax]
 */
export function encodeTemperatureTexture(
  sampleMatrix,
  gridSize,
  tempMin = TEMPERATURE_LUT_MIN,
  tempMax = TEMPERATURE_LUT_MAX,
) {
  const span = tempMax - tempMin || 1
  const data = new Uint8Array(gridSize * gridSize * 4)

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const temp = sampleMatrix[row]?.[col]
      const o = (row * gridSize + col) * 4

      if (temp == null || Number.isNaN(temp)) {
        data[o] = 0
        data[o + 1] = 0
        data[o + 2] = 0
        data[o + 3] = 0
        continue
      }

      const t = Math.max(0, Math.min(1, (temp - tempMin) / span))
      data[o] = Math.round(t * 255)
      data[o + 1] = 0
      data[o + 2] = 0
      data[o + 3] = 255
    }
  }

  return {
    data,
    width: gridSize,
    height: gridSize,
    tempMin,
    tempMax,
  }
}
