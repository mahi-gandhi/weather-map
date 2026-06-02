/**
 * @param {{ header: { nx: number, ny: number }, uData: Float32Array, vData: Float32Array | null }} grid
 * @returns {ImageData}
 */
export function encodeTexture({ header, uData, vData }) {
  const { nx, ny } = header
  const imageData = new ImageData(nx, ny)
  const pixels = imageData.data
  const count = nx * ny

  for (let i = 0; i < count; i++) {
    const offset = i * 4
    pixels[offset] = Math.round(uData[i] * 255)
    pixels[offset + 1] = vData ? Math.round(vData[i] * 255) : 0
    pixels[offset + 2] = 0
    pixels[offset + 3] = 255
  }

  return imageData
}
