import { useCallback, useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { createPortal } from 'react-dom'
import { getVectorData, getSpeedData } from '../lib/fetchOpenMeteo.js'
import { getFirstGrid } from '../lib/getFirstGrid.js'
import { lookupGridBilinear } from '../lib/lookupGrid.js'

// Grid density: 10×10 = 100 evenly-spaced cells across visible map
const GRID_COLS = 10
const GRID_ROWS = 10

// Skip arrows below this speed threshold (filters land, near-zero ocean)
const MIN_SPEED_KN = 0.15

// Arrow geometry limits
const ARROW_BASE_PX = 8
const ARROW_SPEED_SCALE = 12  // px per knot
const ARROW_MAX_PX = 32

const CANVAS_STYLE = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  zIndex: 500,
  pointerEvents: 'none',
}

/**
 * Draw a single arrow centred on (cx, cy) pointing in direction `angle` (radians).
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} cx
 * @param {number} cy
 * @param {number} angle  direction in radians (atan2 convention)
 * @param {number} speed  knots
 */
function drawArrow(ctx, cx, cy, angle, speed) {
  const len = Math.min(ARROW_BASE_PX + speed * ARROW_SPEED_SCALE, ARROW_MAX_PX)
  const headLen = Math.max(4, len * 0.32)
  const headAngle = Math.PI / 6  // 30°

  // Style by speed
  let strokeColor, lineWidth, alpha
  if (speed < 0.3) {
    strokeColor = '0, 210, 255'
    lineWidth = 1.5
    alpha = 0.4
  } else if (speed < 1.0) {
    strokeColor = '0, 210, 255'
    lineWidth = 1.5
    alpha = 0.7
  } else {
    strokeColor = '255, 255, 255'
    lineWidth = 2.0
    alpha = 1.0
  }

  const tail = { x: cx - Math.cos(angle) * len * 0.4, y: cy - Math.sin(angle) * len * 0.4 }
  const head = { x: cx + Math.cos(angle) * len * 0.6, y: cy + Math.sin(angle) * len * 0.6 }

  ctx.save()
  ctx.strokeStyle = `rgba(${strokeColor}, ${alpha})`
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Shaft
  ctx.beginPath()
  ctx.moveTo(tail.x, tail.y)
  ctx.lineTo(head.x, head.y)
  ctx.stroke()

  // Arrowhead — two lines at ±headAngle from the reverse direction
  const rev = angle + Math.PI
  ctx.beginPath()
  ctx.moveTo(head.x, head.y)
  ctx.lineTo(
    head.x + Math.cos(rev - headAngle) * headLen,
    head.y + Math.sin(rev - headAngle) * headLen,
  )
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(head.x, head.y)
  ctx.lineTo(
    head.x + Math.cos(rev + headAngle) * headLen,
    head.y + Math.sin(rev + headAngle) * headLen,
  )
  ctx.stroke()

  ctx.restore()
}

export default function CurrentArrows({ grids }) {
  const map = useMap()
  const canvasRef = useRef(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const vector = getVectorData(grids)
    const speedGrid = getSpeedData(grids)
    if (!canvas || !vector) return

    const header = getFirstGrid(grids)?.header
    if (!header) return

    const container = map.getContainer()
    const w = container.clientWidth
    const h = container.clientHeight
    if (w === 0 || h === 0) return

    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)

    // Evenly spread sample cells across the visible map in screen-space
    for (let row = 0; row < GRID_ROWS; row++) {
      // centre each cell inside its band
      const screenY = (row + 0.5) * (h / GRID_ROWS)
      for (let col = 0; col < GRID_COLS; col++) {
        const screenX = (col + 0.5) * (w / GRID_COLS)

        const latlng = map.containerPointToLatLng([screenX, screenY])

        // Bilinear lookup into the interpolated ocean-current grid
        const speed = lookupGridBilinear(header, speedGrid ?? [], latlng.lat, latlng.lng)
        const u     = lookupGridBilinear(header, vector.u,       latlng.lat, latlng.lng)
        const v     = lookupGridBilinear(header, vector.v,       latlng.lat, latlng.lng)

        // Skip land (returns null from marine API) and near-zero ocean
        if (
          speed == null || u == null || v == null ||
          Number.isNaN(speed) || speed < MIN_SPEED_KN
        ) continue

        const angle = Math.atan2(v, u)
        drawArrow(ctx, screenX, screenY, angle, speed)
      }
    }
  }, [map, grids])

  useEffect(() => {
    draw()
    map.on('moveend', draw)
    map.on('zoomend', draw)
    map.on('resize',  draw)
    return () => {
      map.off('moveend', draw)
      map.off('zoomend', draw)
      map.off('resize',  draw)
    }
  }, [map, draw])

  return createPortal(
    <canvas ref={canvasRef} style={CANVAS_STYLE} />,
    map.getContainer(),
  )
}
