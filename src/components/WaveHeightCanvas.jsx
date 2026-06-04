import { useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { syncWeatherCanvasToMapContainer } from '../lib/temperatureCanvasSync.js'

const GRID_COLS = 360
const GRID_ROWS = 181

const RENDER_SCALE = 1 / 2
const BLUR_PX = 4
const OVERLAY_OPACITY = 0.85
const LUT_SIZE = 256

/** Linear RGB stops (0.5–6 m); alpha 180→220 across ocean range. */
const WAVE_STOPS = [
  { value: 0.5, rgb: [0, 80, 200], alpha: 180 },
  { value: 1.0, rgb: [0, 140, 255], alpha: 190 },
  { value: 1.5, rgb: [0, 200, 255], alpha: 195 },
  { value: 2.0, rgb: [0, 255, 200], alpha: 200 },
  { value: 3.0, rgb: [100, 255, 100], alpha: 205 },
  { value: 4.0, rgb: [255, 255, 0], alpha: 210 },
  { value: 5.0, rgb: [255, 150, 0], alpha: 215 },
  { value: 6.0, rgb: [255, 50, 0], alpha: 220 },
]

function lerp(a, b, t) {
  return a + (b - a) * t
}

/**
 * Linear RGB interpolation between wave stops.
 * @param {number} value — wave height in meters
 * @returns {[number, number, number, number] | null}
 */
function sampleWaveColorLinear(value) {
  if (value == null || Number.isNaN(value) || value < WAVE_STOPS[0].value) {
    return null
  }

  if (value >= WAVE_STOPS[WAVE_STOPS.length - 1].value) {
    const last = WAVE_STOPS[WAVE_STOPS.length - 1]
    return [...last.rgb, last.alpha]
  }

  for (let i = 0; i < WAVE_STOPS.length - 1; i++) {
    const a = WAVE_STOPS[i]
    const b = WAVE_STOPS[i + 1]
    if (value <= b.value) {
      const t = (value - a.value) / (b.value - a.value)
      return [
        Math.round(lerp(a.rgb[0], b.rgb[0], t)),
        Math.round(lerp(a.rgb[1], b.rgb[1], t)),
        Math.round(lerp(a.rgb[2], b.rgb[2], t)),
        Math.round(lerp(a.alpha, b.alpha, t)),
      ]
    }
  }

  const last = WAVE_STOPS[WAVE_STOPS.length - 1]
  return [...last.rgb, last.alpha]
}

function buildWaveColorLut() {
  const min = WAVE_STOPS[0].value
  const max = WAVE_STOPS[WAVE_STOPS.length - 1].value
  const lut = new Uint8ClampedArray(LUT_SIZE * 4)

  for (let i = 0; i < LUT_SIZE; i++) {
    const value = min + (i / (LUT_SIZE - 1)) * (max - min)
    const color = sampleWaveColorLinear(value)
    const o = i * 4
    if (!color) {
      lut[o] = 0
      lut[o + 1] = 0
      lut[o + 2] = 0
      lut[o + 3] = 0
    } else {
      lut[o] = color[0]
      lut[o + 1] = color[1]
      lut[o + 2] = color[2]
      lut[o + 3] = color[3]
    }
  }

  return { lut, min, max }
}

function valueToWaveLutIndex(value, min, max) {
  if (max <= min) return 0
  const t = (value - min) / (max - min)
  return Math.max(0, Math.min(LUT_SIZE - 1, Math.round(t * (LUT_SIZE - 1))))
}

function createOffscreen(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h)
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * Bilinear sample on global 1° grid; skip if any corner is land (0).
 * @param {number} lat
 * @param {number} lng
 * @param {ArrayLike<number>} data
 * @returns {number | null}
 */
function sampleGlobalWaveBilinear(lat, lng, data) {
  if (lat > 90 || lat < -90) return null

  const lonF = ((lng % 360) + 360) % 360
  const col0 = Math.floor(lonF)
  const col1 = (col0 + 1) % GRID_COLS
  const tx = lonF - col0

  const latF = 90 - lat
  const row0 = Math.floor(latF)
  const row1 = Math.min(row0 + 1, GRID_ROWS - 1)
  const ty = latF - row0

  if (row0 < 0 || row0 >= GRID_ROWS) return null

  const v00 = data[row0 * GRID_COLS + col0]
  const v10 = data[row0 * GRID_COLS + col1]
  const v01 = data[row1 * GRID_COLS + col0]
  const v11 = data[row1 * GRID_COLS + col1]

  if (v00 === 0 || v10 === 0 || v01 === 0 || v11 === 0) {
    return null
  }

  const n00 = v00 ?? 0
  const n10 = v10 ?? 0
  const n01 = v01 ?? 0
  const n11 = v11 ?? 0

  const value =
    n00 * (1 - tx) * (1 - ty) +
    n10 * tx * (1 - ty) +
    n01 * (1 - tx) * ty +
    n11 * tx * ty

  if (Number.isNaN(value) || value <= 0) return null

  return value
}

export default function WaveHeightCanvas({ grids }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)

  const lutSpec = useMemo(() => buildWaveColorLut(), [])

  const gridData = useMemo(() => {
    if (!grids?.[0]?.data) return null
    return grids[0].data
  }, [grids])

  useEffect(() => {
    const container = map.getContainer()
    const canvas = document.createElement('canvas')
    canvas.className = 'wave-height-canvas smooth-weather-canvas'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '650'
    container.appendChild(canvas)
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

    const data = gridData
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

      for (let row = 0; row < lowH; row++) {
        const screenY = Math.min(cssH - 1, (row + 0.5) * stepY)
        for (let col = 0; col < lowW; col++) {
          const screenX = Math.min(cssW - 1, (col + 0.5) * stepX)
          const latlng = map.containerPointToLatLng([screenX, screenY])
          const value = sampleGlobalWaveBilinear(latlng.lat, latlng.lng, data)

          const i = (row * lowW + col) * 4

          if (value == null) {
            px[i] = 0
            px[i + 1] = 0
            px[i + 2] = 0
            px[i + 3] = 0
            continue
          }

          const lutIdx = valueToWaveLutIndex(value, lutMin, lutMax)
          const o = lutIdx * 4
          px[i] = lut[o]
          px[i + 1] = lut[o + 1]
          px[i + 2] = lut[o + 2]
          px[i + 3] = lut[o + 3]
        }
      }

      fctx.putImageData(imageData, 0, 0)
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
        blurSurface = createOffscreen(cssW, cssH)
      }

      renderPixels(lowW, lowH, cssW, cssH)
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

  return null
}
