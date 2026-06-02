/**
 * Minimal GRIB2 wind extraction (UGRD/VGRD @ 10m).
 * Returns null when buffer is not a decodable GRIB2 wind subset.
 * @param {ArrayBuffer} buffer
 * @returns {{ u: Float32Array, v: Float32Array, nx: number, ny: number } | null}
 */
export function parseGrib2WindBuffer(buffer) {
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  if (bytes.length < 8) return null
  const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
  if (sig !== 'GRIB') return null

  try {
    return scanGrib2ForWind(view, bytes)
  } catch (err) {
    console.warn('[grib2] parse failed', err)
    return null
  }
}

function scanGrib2ForWind(view, bytes) {
  let offset = 0
  const uGrids = []
  const vGrids = []

  while (offset + 16 < bytes.length) {
    if (
      bytes[offset] !== 0x47 ||
      bytes[offset + 1] !== 0x52 ||
      bytes[offset + 2] !== 0x49 ||
      bytes[offset + 3] !== 0x42
    ) {
      offset++
      continue
    }

    const edition = bytes[offset + 7]
    if (edition !== 2) {
      offset += 8
      continue
    }

    const msgLen = view.getUint32(offset + 4)
    if (msgLen < 24 || offset + msgLen > bytes.length) {
      offset += 8
      continue
    }

    const meta = readGrib2MessageMeta(bytes, offset, msgLen)
    if (meta?.parameterCategory === 2) {
      const grid = decodeGrib2DataArray(view, bytes, offset, msgLen, meta)
      if (grid) {
        if (meta.parameterNumber === 2) uGrids.push(grid)
        if (meta.parameterNumber === 3) vGrids.push(grid)
      }
    }

    offset += msgLen
  }

  if (uGrids.length === 0 || vGrids.length === 0) return null

  const u = uGrids[uGrids.length - 1]
  const v = vGrids[vGrids.length - 1]
  if (u.nx !== v.nx || u.ny !== v.ny) return null

  return {
    u: u.values,
    v: v.values,
    nx: u.nx,
    ny: u.ny,
  }
}

function readGrib2MessageMeta(bytes, offset, msgLen) {
  const end = Math.min(offset + msgLen, bytes.length)
  let i = offset + 16

  while (i + 5 < end) {
    const section = bytes[i]
    const secLen = readUint32(bytes, i + 1)
    if (secLen < 5 || i + secLen > end) break

    if (section === 4 && secLen >= 34) {
      const parameterCategory = bytes[i + 9]
      const parameterNumber = bytes[i + 10]
      return { parameterCategory, parameterNumber, section4Start: i, section4Len: secLen }
    }

    i += secLen
  }

  return null
}

function decodeGrib2DataArray(view, bytes, msgOffset, msgLen, meta) {
  const end = msgOffset + msgLen
  let i = msgOffset + 16
  let gridDef = null
  let dataSection = null

  while (i + 5 < end) {
    const section = bytes[i]
    const secLen = readUint32(bytes, i + 1)
    if (secLen < 5 || i + secLen > end) break

    if (section === 3 && secLen >= 20) {
      gridDef = parseGridDefinition(bytes, i, secLen)
    }
    if (section === 7) {
      dataSection = { start: i + 5, length: secLen - 5 }
    }

    i += secLen
  }

  if (!gridDef || !dataSection) return null

  const { nx, ny, points } = gridDef
  const count = nx * ny
  if (count <= 0 || count > 4_000_000) return null

  const dataStart = dataSection.start
  const flags = bytes[dataStart]
  const refVal = view.getFloat32(dataStart + 1)
  const binScale = view.getInt16(dataStart + 5)
  const decScale = view.getInt16(dataStart + 7)
  const nBits = bytes[dataStart + 9]

  if (nBits !== 8 && nBits !== 16) return null

  let pos = dataStart + 11
  const values = new Float32Array(count)
  const scale = Math.pow(10, -decScale) * Math.pow(2, binScale)

  for (let p = 0; p < count; p++) {
    let raw = 0
    if (nBits === 8) {
      raw = bytes[pos++]
    } else {
      raw = view.getUint16(pos)
      pos += 2
    }
    values[p] = (refVal + raw * scale) * 1.0
  }

  return { nx, ny, values }
}

function parseGridDefinition(bytes, secStart, secLen) {
  const template = readUint16(bytes, secStart + 12)
  if (template !== 0) return null

  const nx = readUint16(bytes, secStart + 30)
  const ny = readUint16(bytes, secStart + 32)
  if (nx < 2 || ny < 2) return null

  return { nx, ny, points: nx * ny }
}

function readUint16(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function readUint32(bytes, offset) {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}
