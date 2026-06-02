/**
 * @param {{ header: { nx: number, ny: number }, uData: Float32Array }} grid
 * @param {{ ramp: { pos: number, rgba: [number, number, number, number] }[], zeroThreshold?: number }} layer
 * @returns {ImageData}
 */
export function encodeLayerRamp({ header, uData }, layer) {
  const { ramp, zeroThreshold = 0 } = layer
  const imageData = new ImageData(header.nx, header.ny)
  const pixels = imageData.data

  for (let i = 0; i < uData.length; i++) {
    const [r, g, b, a] = sampleRamp(uData[i], ramp, zeroThreshold)
    const offset = i * 4
    pixels[offset] = r
    pixels[offset + 1] = g
    pixels[offset + 2] = b
    pixels[offset + 3] = a
  }

  return imageData
}

function lerpChannel(a, b, t) {
  return Math.round(a + (b - a) * t)
}

function sampleRamp(value, stops, zeroThreshold) {
  if (value < zeroThreshold) {
    return [0, 0, 0, 0]
  }

  for (let i = 0; i < stops.length - 1; i++) {
    const start = stops[i]
    const end = stops[i + 1]
    if (value <= end.pos) {
      const range = end.pos - start.pos
      const t = range === 0 ? 1 : (value - start.pos) / range
      return [
        lerpChannel(start.rgba[0], end.rgba[0], t),
        lerpChannel(start.rgba[1], end.rgba[1], t),
        lerpChannel(start.rgba[2], end.rgba[2], t),
        lerpChannel(start.rgba[3], end.rgba[3], t),
      ]
    }
  }

  return stops[stops.length - 1].rgba
}
