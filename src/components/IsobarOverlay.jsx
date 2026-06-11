import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { fetchPressureGrid } from '../lib/fetchPressureGrid.js'
import { marchingSquaresContours } from '../lib/marchingSquares.js'
import { boundsFromHeader, sampleNodeLatLng } from '../lib/sampleTemperatureMatrix.js'

const ISOBAR_STEP = 4
const MAJOR_LEVELS = new Set([1000, 1008, 1016])
const MAX_SEGMENT_PX = 50
const ISOBAR_OPACITY = 0.25

/**
 * @param {number[][]} samples
 * @param {number} gridSize
 */
function minMaxPressure(samples, gridSize) {
  let min = Infinity
  let max = -Infinity
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const v = samples[row]?.[col]
      if (v == null || Number.isNaN(v)) continue
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  return { min, max }
}

export default function IsobarOverlay() {
  const map = useMap()
  const canvasRef = useRef(null)
  const fetchGenRef = useRef(0)

  useEffect(() => {
    const pane = map.getPanes().overlayPane
    const canvas = document.createElement('canvas')
    canvas.className = 'isobar-canvas'
    canvas.style.cssText =
      'position:absolute;pointer-events:none;z-index:470;'
    pane.appendChild(canvas)
    canvasRef.current = canvas

    const syncCanvas = () => {
      const size = map.getSize()
      const topLeft = map.containerPointToLayerPoint([0, 0])
      canvas.style.left = `${-topLeft.x}px`
      canvas.style.top = `${-topLeft.y}px`
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`
      canvas.width = Math.max(1, size.x)
      canvas.height = Math.max(1, size.y)
    }

    const draw = async () => {
      syncCanvas()
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const gen = ++fetchGenRef.current
      let grid
      try {
        grid = await fetchPressureGrid(map.getBounds())
      } catch (err) {
        console.warn('[IsobarOverlay] pressure fetch failed', err)
        return
      }
      if (gen !== fetchGenRef.current) return

      const { samples, gridSize } = grid
      const geoBounds = boundsFromHeader(grid.header)
      const { min, max } = minMaxPressure(samples, gridSize)
      if (!Number.isFinite(min) || !Number.isFinite(max)) return

      const start = Math.ceil(min / ISOBAR_STEP) * ISOBAR_STEP
      const origin = map.containerPointToLayerPoint([0, 0])

      ctx.strokeStyle = `rgba(255, 255, 255, ${ISOBAR_OPACITY})`
      ctx.lineWidth = 1
      ctx.font = '10px Inter, system-ui, sans-serif'
      ctx.fillStyle = `rgba(255, 255, 255, ${ISOBAR_OPACITY + 0.2})`

      function gridPointToScreen(col, row) {
        const { lat, lon } = sampleNodeLatLng(row, col, gridSize, geoBounds)
        const pt = map.latLngToLayerPoint([lat, lon])
        return { x: pt.x - origin.x, y: pt.y - origin.y }
      }

      for (let level = start; level <= max; level += ISOBAR_STEP) {
        const segments = marchingSquaresContours(samples, level)

        for (const [a, b] of segments) {
          const ptA = gridPointToScreen(a[0], a[1])
          const ptB = gridPointToScreen(b[0], b[1])
          const len = Math.hypot(ptB.x - ptA.x, ptB.y - ptA.y)
          if (len > MAX_SEGMENT_PX) continue

          ctx.beginPath()
          ctx.moveTo(ptA.x, ptA.y)
          ctx.lineTo(ptB.x, ptB.y)
          ctx.stroke()

          if (MAJOR_LEVELS.has(level)) {
            const mx = (ptA.x + ptB.x) / 2
            const my = (ptA.y + ptB.y) / 2
            if (mx > 40 && mx < w - 40 && my > 40 && my < h - 40) {
              ctx.fillText(`${level}`, mx + 4, my - 4)
            }
          }
        }
      }
    }

    let rafId = null
    const scheduleDraw = () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        draw()
      })
    }

    syncCanvas()
    scheduleDraw()
    map.on('moveend', scheduleDraw)
    map.on('zoomend', scheduleDraw)
    map.on('resize', scheduleDraw)

    return () => {
      fetchGenRef.current += 1
      if (rafId != null) cancelAnimationFrame(rafId)
      map.off('moveend', scheduleDraw)
      map.off('zoomend', scheduleDraw)
      map.off('resize', scheduleDraw)
      canvas.remove()
      canvasRef.current = null
    }
  }, [map])

  return null
}
