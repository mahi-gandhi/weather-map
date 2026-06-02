function normalizeLongitude(lng, west, east) {
  let lon = lng
  if (east - west >= 180) {
    while (lon < west) lon += 360
    while (lon > east) lon -= 360
  }
  return lon
}

/**
 * Nearest grid cell value at lat/lng, or null if outside the grid.
 * @param {{ nx: number, ny: number, la1: number, la2: number, lo1: number, lo2: number, dx: number, dy: number }} header
 * @param {ArrayLike<number>} data
 * @param {number} lat
 * @param {number} lng
 * @returns {number | null}
 */
export function lookupGridValue(header, data, lat, lng) {
  const south = Math.min(header.la1, header.la2)
  const north = Math.max(header.la1, header.la2)
  const west = Math.min(header.lo1, header.lo2)
  const east = Math.max(header.lo1, header.lo2)

  if (lat < south || lat > north) return null

  const lon = normalizeLongitude(lng, west, east)
  if (lon < west || lon > east) return null

  const { nx, ny, la1, lo1, dx, dy } = header
  const latDelta = la1 >= header.la2 ? dy : -dy
  const lonDelta = lo1 <= header.lo2 ? dx : -dx

  const row = Math.round((la1 - lat) / latDelta)
  const col = Math.round((lon - lo1) / lonDelta)

  if (row < 0 || row >= ny || col < 0 || col >= nx) return null

  return data[row * nx + col]
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Bilinear sample on the interpolated grid at lat/lng.
 * @param {{ nx: number, ny: number, la1: number, la2: number, lo1: number, lo2: number, dx: number, dy: number }} header
 * @param {ArrayLike<number>} data
 * @param {number} lat
 * @param {number} lng
 * @returns {number | null}
 */
export function lookupGridBilinear(header, data, lat, lng) {
  const south = Math.min(header.la1, header.la2)
  const north = Math.max(header.la1, header.la2)
  const west = Math.min(header.lo1, header.lo2)
  const east = Math.max(header.lo1, header.lo2)

  if (lat < south || lat > north) return null

  const lon = normalizeLongitude(lng, west, east)
  if (lon < west || lon > east) return null

  const { nx, ny } = header
  const latSpan = north - south
  const lonSpan = east - west

  const ty = latSpan === 0 ? 0 : ((north - lat) / latSpan) * (ny - 1)
  const tx = lonSpan === 0 ? 0 : ((lon - west) / lonSpan) * (nx - 1)

  const y0 = Math.floor(ty)
  const x0 = Math.floor(tx)
  const y1 = Math.min(y0 + 1, ny - 1)
  const x1 = Math.min(x0 + 1, nx - 1)
  const fy = ty - y0
  const fx = tx - x0

  const v00 = data[y0 * nx + x0]
  const v10 = data[y0 * nx + x1]
  const v01 = data[y1 * nx + x0]
  const v11 = data[y1 * nx + x1]

  const corners = [
    { v: v00, w: (1 - fx) * (1 - fy) },
    { v: v10, w: fx * (1 - fy) },
    { v: v01, w: (1 - fx) * fy },
    { v: v11, w: fx * fy },
  ]

  const valid = corners.filter(
    (c) => c.v != null && !Number.isNaN(c.v),
  )
  if (valid.length === 0) return null
  if (valid.length === 4) {
    const top = lerp(v00, v10, fx)
    const bottom = lerp(v01, v11, fx)
    return lerp(top, bottom, fy)
  }

  const weightSum = valid.reduce((sum, c) => sum + c.w, 0)
  if (weightSum <= 0) return valid[0].v
  return valid.reduce((sum, c) => sum + c.v * (c.w / weightSum), 0)
}
