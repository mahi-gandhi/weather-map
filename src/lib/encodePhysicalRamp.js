import { sampleStopsHsl } from './colorLut.js'

/**
 * Color ramp using real-world values (meters, mm/h, etc.).
 * @param {{ header: { nx: number, ny: number }, values: Float32Array | number[] }} grid
 * @param {{ physicalStops: { value: number, rgba: [number, number, number, number] }[], minVisible?: number }} layer
 * @returns {ImageData}
 */
export function encodePhysicalRamp({ header, values }, layer) {
  const { physicalStops, minVisible = 0 } = layer
  const imageData = new ImageData(header.nx, header.ny)
  const pixels = imageData.data

  for (let i = 0; i < values.length; i++) {
    const [r, g, b, a] = sampleStopsHsl(
      values[i],
      physicalStops,
      minVisible,
    )
    const offset = i * 4
    pixels[offset] = r
    pixels[offset + 1] = g
    pixels[offset + 2] = b
    pixels[offset + 3] = a
  }

  return imageData
}
