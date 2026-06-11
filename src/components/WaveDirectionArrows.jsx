import { useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { sampleGlobalWaveBilinear } from '../lib/waveStaticGrid.js'
import { swellScreenAngle } from '../lib/waveSwellDirection.js'

const ARROW_SPACING = 120
const MIN_ZOOM = 5
const BASE_ARROW_LEN = 12
const MIN_WAVE_HEIGHT = 0.3

function drawArrow(ctx, x, y, angle, length) {
  const headLen = length * 0.35
  const tailX = x - Math.cos(angle) * length
  const tailY = y - Math.sin(angle) * length

  ctx.beginPath()
  ctx.moveTo(tailX, tailY)
  ctx.lineTo(x, y)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(
    x - headLen * Math.cos(angle - Math.PI / 6),
    y - headLen * Math.sin(angle - Math.PI / 6),
  )
  ctx.moveTo(x, y)
  ctx.lineTo(
    x - headLen * Math.cos(angle + Math.PI / 6),
    y - headLen * Math.sin(angle + Math.PI / 6),
  )
  ctx.stroke()
}

export default function WaveDirectionArrows({ grids, active }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)

  const gridData = useMemo(() => grids?.[0]?.data ?? null, [grids])

  useEffect(() => {
    const pane = map.getPanes().overlayPane
    const canvas = document.createElement('canvas')
    canvas.className = 'wave-direction-arrows'
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '380'
    canvas.style.background = 'transparent'
    pane.appendChild(canvas)
    canvasRef.current = canvas

    return () => {
      overlayRef.current?.destroy()
      overlayRef.current = null
      canvas.remove()
      canvasRef.current = null
    }
  }, [map])

  useEffect(() => {
    overlayRef.current?.destroy()
    overlayRef.current = null

    const canvas = canvasRef.current
    if (!canvas || !gridData || !active) {
      canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvas?.width ?? 0, canvas?.height ?? 0)
      if (canvas) canvas.style.display = 'none'
      return
    }

    canvas.style.display = 'block'
    const data = gridData
    let rafId = null

    function syncCanvas() {
      const size = map.getSize()
      const topLeft = map.containerPointToLayerPoint([0, 0])
      canvas.style.left = `${-topLeft.x}px`
      canvas.style.top = `${-topLeft.y}px`
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`
      canvas.width = Math.max(1, size.x)
      canvas.height = Math.max(1, size.y)
    }

    function draw() {
      syncCanvas()
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      if (map.getZoom() < MIN_ZOOM) return

      const origin = map.containerPointToLayerPoint([0, 0])
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      for (let sy = ARROW_SPACING / 2; sy < h; sy += ARROW_SPACING) {
        for (let sx = ARROW_SPACING / 2; sx < w; sx += ARROW_SPACING) {
          const latlng = map.containerPointToLatLng([sx, sy])
          const value = sampleGlobalWaveBilinear(latlng.lat, latlng.lng, data)
          if (value == null || value <= MIN_WAVE_HEIGHT) continue

          const angle = swellScreenAngle(
            map,
            latlng.lat,
            latlng.lng,
            origin,
          )
          if (angle == null) continue

          const basePt = map.latLngToLayerPoint([latlng.lat, latlng.lng])
          const tipX = basePt.x - origin.x + Math.cos(angle) * BASE_ARROW_LEN
          const tipY = basePt.y - origin.y + Math.sin(angle) * BASE_ARROW_LEN

          const scale = 0.85 + Math.min(1, value / 7) * 0.35
          const length = BASE_ARROW_LEN * scale

          drawArrow(ctx, tipX, tipY, angle, length)
        }
      }
    }

    function scheduleDraw() {
      if (rafId != null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        rafId = null
        draw()
      })
    }

    const onMapChange = () => scheduleDraw()

    overlayRef.current = {
      start() {
        scheduleDraw()
        map.on('moveend', onMapChange)
        map.on('zoomend', onMapChange)
        map.on('resize', onMapChange)
      },
      destroy() {
        if (rafId != null) cancelAnimationFrame(rafId)
        map.off('moveend', onMapChange)
        map.off('zoomend', onMapChange)
        map.off('resize', onMapChange)
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, canvas.width, canvas.height)
      },
    }

    overlayRef.current.start()

    return () => {
      overlayRef.current?.destroy()
      overlayRef.current = null
    }
  }, [map, gridData, active])

  return null
}
