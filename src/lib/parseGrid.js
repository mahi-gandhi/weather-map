function toFloat32Normalized(data) {
  const out = new Float32Array(data.length)
  let min = Infinity
  let max = -Infinity

  for (let i = 0; i < data.length; i++) {
    const v = data[i]
    if (v < min) min = v
    if (v > max) max = v
  }

  const range = max - min
  if (range === 0) {
    out.fill(0)
    return out
  }

  for (let i = 0; i < data.length; i++) {
    out[i] = (data[i] - min) / range
  }

  return out
}

/**
 * @param {Array<{ header: object, data: number[] }> | { header: object, data: number[] }} raw
 * @returns {{ header: object, uData: Float32Array, vData: Float32Array | null }}
 */
export function parseGrid(raw) {
  const items = Array.isArray(raw) ? raw : [raw]

  if (items.length === 0) {
    throw new Error('parseGrid: expected at least one grid object')
  }

  const { header, data } = items[0]

  return {
    header,
    uData: toFloat32Normalized(data),
    vData:
      items.length > 1 ? toFloat32Normalized(items[1].data) : null,
  }
}
