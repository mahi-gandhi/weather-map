import { marchingSquaresContours } from './marchingSquares.js'

const ISOBAR_STEP = 4
const MAJOR_LEVELS = new Set([984, 992, 1000, 1008, 1016, 1024, 1032, 1040])

const LEVELS = []
for (let p = 960; p <= 1044; p += ISOBAR_STEP) {
  LEVELS.push(p)
}

/**
 * @param {{ lo1: number, dx: number, dy: number, la1: number }} header
 * @param {number} col — may be fractional (edge interpolation)
 * @param {number} row
 */
function gridPointToLatLng(header, col, row) {
  return {
    lat: header.la1 - row * header.dy,
    lon: header.lo1 + col * header.dx,
  }
}

/**
 * Build 2D pressure field with a wrapped longitude column for closed contours.
 * @param {{ nx: number, ny: number }} header
 * @param {ArrayLike<number>} data
 */
function buildFieldWithWrap(header, data) {
  const { nx, ny } = header
  const field = []
  for (let row = 0; row < ny; row++) {
    const rowVals = []
    for (let col = 0; col < nx; col++) {
      const v = data[row * nx + col]
      rowVals.push(v == null || Number.isNaN(v) ? NaN : v)
    }
    rowVals.push(rowVals[0])
    field.push(rowVals)
  }
  return field
}

/**
 * @param {import('leaflet').Map} map
 * @param {{ getSouth: () => number, getNorth: () => number, getWest: () => number, getEast: () => number }} bounds
 * @param {number} lat
 * @param {number} lon
 */
function isInExpandedBounds(map, bounds, lat, lon) {
  const south = bounds.getSouth() - 5
  const north = bounds.getNorth() + 5
  if (lat < south || lat > north) return false

  const west = bounds.getWest() - 5
  const east = bounds.getEast() + 5
  if (east - west >= 360) return true

  let lng = lon
  const centerLng = map.getCenter().lng
  while (lng < centerLng - 180) lng += 360
  while (lng > centerLng + 180) lng -= 360

  return lng >= west && lng <= east
}

export class IsobarCanvas {
  /**
   * @param {import('leaflet').Map} map
   * @param {{ header: object, data: number[] }} pressureData
   */
  constructor(map, pressureData) {
    this.map = map
    this.header = pressureData.header
    this.data = pressureData.data
    this.field = buildFieldWithWrap(this.header, this.data)
    this.contoursByLevel = new Map()
    for (const level of LEVELS) {
      this.contoursByLevel.set(level, marchingSquaresContours(this.field, level))
    }

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'isobar-canvas'
    this.canvas.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:430;'
    map.getContainer().appendChild(this.canvas)

    this.draw = this.draw.bind(this)
    this.draw()
    map.on('moveend zoomend resize', this.draw)
  }

  draw() {
    const map = this.map
    const container = map.getContainer()
    const W = container.offsetWidth
    const H = container.offsetHeight
    if (W <= 0 || H <= 0) return

    this.canvas.width = W
    this.canvas.height = H
    const ctx = this.canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, W, H)

    const { header, contoursByLevel } = this
    const bounds = map.getBounds()
    const center = map.getCenter()

    ctx.strokeStyle = 'rgba(180, 180, 180, 0.6)'
    ctx.lineWidth = 1
    ctx.font = '11px Inter, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(220, 220, 220, 0.8)'

    const labeledLevels = new Set()

    for (const level of LEVELS) {
      const segments = contoursByLevel.get(level) ?? []

      for (const [a, b] of segments) {
        const { lat: latA, lon: lonA } = gridPointToLatLng(header, a[0], a[1])
        const { lat: latB, lon: lonB } = gridPointToLatLng(header, b[0], b[1])

        if (
          !isInExpandedBounds(map, bounds, latA, lonA) &&
          !isInExpandedBounds(map, bounds, latB, lonB)
        ) {
          continue
        }

        const ptA = map.latLngToContainerPoint([latA, lonA])
        const ptB = map.latLngToContainerPoint([latB, lonB])

        ctx.beginPath()
        ctx.moveTo(ptA.x, ptA.y)
        ctx.lineTo(ptB.x, ptB.y)
        ctx.stroke()

        if (
          MAJOR_LEVELS.has(level) &&
          !labeledLevels.has(level) &&
          Math.abs((latA + latB) / 2 - center.lat) < 12 &&
          Math.abs((lonA + lonB) / 2 - center.lng) < 18
        ) {
          const mx = (ptA.x + ptB.x) / 2
          const my = (ptA.y + ptB.y) / 2
          if (mx > 48 && mx < W - 48 && my > 24 && my < H - 24) {
            ctx.fillText(String(level), mx + 4, my - 4)
            labeledLevels.add(level)
          }
        }
      }
    }
  }

  destroy() {
    this.map.off('moveend zoomend resize', this.draw)
    this.canvas.remove()
  }
}
