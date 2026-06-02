import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import { LAYERS } from '../lib/layers.js'
import { buildPhysicalColorLut, valueToLutIndex } from '../lib/colorLut.js'
import { lookupGridBilinear } from '../lib/lookupGrid.js'
import { syncWeatherCanvasToMapContainer } from '../lib/temperatureCanvasSync.js'

const RENDER_SCALE = 1 / 3
const BLUR_PX = 10
const OVERLAY_OPACITY = 0.8
const NO_RAIN_THRESHOLD = 0.05

const PRECIP_LAYER = LAYERS.precipitation

function createOffscreen(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h)
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export default function PrecipitationCanvas({ grids }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const [noRain, setNoRain] = useState(false)

  const lutSpec = useMemo(() => {
    return buildPhysicalColorLut(PRECIP_LAYER.physicalStops, PRECIP_LAYER.minVisible)
  }, [])

  const gridData = useMemo(() => {
    if (!grids?.length) return null
    return { header: grids[0].header, data: grids[0].data }
  }, [grids])

  useEffect(() => {
    const pane = map.getPanes().overlayPane
    const canvas = document.createElement('canvas')
    canvas.className = 'precipitation-canvas'
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '450'
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
    if (!canvas || !gridData) return

    const { header, data } = gridData
    const { lut, min: lutMin, max: lutMax } = lutSpec

    let fieldSurface = createOffscreen(1, 1)
    let upscaleSurface = createOffscreen(1, 1)
    let blurSurface = createOffscreen(1, 1)
    let rafId = null

    function syncPosition() {
      syncWeatherCanvasToMapContainer(canvas, map)
      canvas.style.imageRendering = 'auto'
    }

    function renderPixels(lowW, lowH, cssW, cssH) {
      const fctx = fieldSurface.getContext('2d', { willReadFrequently: true })
      if (!fctx) return

      const imageData = fctx.createImageData(lowW, lowH)
      const px = imageData.data
      const stepX = cssW / lowW
      const stepY = cssH / lowH
      let maxVal = 0

      for (let row = 0; row < lowH; row++) {
        const screenY = Math.min(cssH - 1, (row + 0.5) * stepY)
        for (let col = 0; col < lowW; col++) {
          const screenX = Math.min(cssW - 1, (col + 0.5) * stepX)
          const latlng = map.containerPointToLatLng([screenX, screenY])
          const value = lookupGridBilinear(header, data, latlng.lat, latlng.lng)

          const i = (row * lowW + col) * 4

          if (value == null || Number.isNaN(value) || value < NO_RAIN_THRESHOLD) {
            px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0
            continue
          }

          if (value > maxVal) maxVal = value

          const idx = valueToLutIndex(value, lutMin, lutMax)
          const o = idx * 4
          px[i]     = lut[o]
          px[i + 1] = lut[o + 1]
          px[i + 2] = lut[o + 2]
          px[i + 3] = lut[o + 3]
        }
      }

      fctx.putImageData(imageData, 0, 0)
      return maxVal
    }

    function upscaleField(lowW, lowH, cssW, cssH) {
      const uctx = upscaleSurface.getContext('2d')
      if (!uctx) return
      uctx.clearRect(0, 0, cssW, cssH)
      uctx.imageSmoothingEnabled = true
      uctx.imageSmoothingQuality = 'high'
      uctx.drawImage(fieldSurface, 0, 0, lowW, lowH, 0, 0, cssW, cssH)
    }

    function applyBlur(cssW, cssH) {
      const bctx = blurSurface.getContext('2d')
      if (!bctx) return
      bctx.clearRect(0, 0, cssW, cssH)
      bctx.filter = `blur(${BLUR_PX}px)`
      bctx.drawImage(upscaleSurface, 0, 0)
      bctx.filter = 'none'
    }

    function draw() {
      syncPosition()
      const cssW = canvas.width
      const cssH = canvas.height
      if (cssW <= 0 || cssH <= 0) return

      const lowW = Math.max(1, Math.round(cssW * RENDER_SCALE))
      const lowH = Math.max(1, Math.round(cssH * RENDER_SCALE))

      if (fieldSurface.width !== lowW || fieldSurface.height !== lowH) {
        fieldSurface = createOffscreen(lowW, lowH)
      }
      if (upscaleSurface.width !== cssW || upscaleSurface.height !== cssH) {
        upscaleSurface = createOffscreen(cssW, cssH)
        blurSurface    = createOffscreen(cssW, cssH)
      }

      const maxVal = renderPixels(lowW, lowH, cssW, cssH)

      if (maxVal < NO_RAIN_THRESHOLD) {
        const ctx = canvas.getContext('2d')
        ctx?.clearRect(0, 0, cssW, cssH)
        setNoRain(true)
        return
      }

      setNoRain(false)
      upscaleField(lowW, lowH, cssW, cssH)
      applyBlur(cssW, cssH)

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cssW, cssH)
      ctx.globalAlpha = OVERLAY_OPACITY
      ctx.globalCompositeOperation = 'source-over'
      ctx.drawImage(blurSurface, 0, 0)
      ctx.globalAlpha = 1
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
      redraw: scheduleDraw,
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
  }, [map, gridData, lutSpec])

  if (!noRain) return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: '120px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,0.6)',
        color: '#aee',
        padding: '6px 16px',
        borderRadius: '20px',
        fontSize: '13px',
        pointerEvents: 'none',
        zIndex: 1000,
        whiteSpace: 'nowrap',
      }}
    >
      No precipitation in this area
    </div>,
    document.body,
  )
}
