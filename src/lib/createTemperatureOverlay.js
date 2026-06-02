import { boundsFromHeader, sampleTemperatureAtLatLng } from './sampleTemperatureMatrix.js'
import {
  buildTemperatureLut1024,
  temperatureToLutIndex,
  TEMPERATURE_LUT_SIZE,
  logTemperatureRenderDebug,
} from './temperatureLut.js'
import { syncWeatherCanvasToMapContainer } from './temperatureCanvasSync.js'

const RENDER_SCALE = 1 / 3
const BLUR_PX = 12
const OVERLAY_OPACITY = 0.75

/**
 * @param {number} width
 * @param {number} height
 */
function createOffscreenSurface(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height)
  }
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  return c
}

/**
 * Smooth temperature field overlay (1/3-res render → upscale → blur).
 * @param {HTMLCanvasElement} canvas
 * @param {import('leaflet').Map} map
 * @param {object} options
 * @param {number[][]} options.sampleMatrix
 * @param {number} options.sampleSize
 * @param {object} options.header
 * @param {{ lut: Float32Array, min: number, max: number, size?: number }} [options.lutSpec]
 */
export function createTemperatureOverlay(
  canvas,
  map,
  { sampleMatrix, sampleSize, header, lutSpec },
) {
  const {
    lut,
    min: lutMin,
    max: lutMax,
    size: lutSize = TEMPERATURE_LUT_SIZE,
  } = lutSpec ?? buildTemperatureLut1024()

  const bounds = boundsFromHeader(header)

  logTemperatureRenderDebug(sampleMatrix, lut, lutMin, lutMax)

  let fieldSurface = createOffscreenSurface(1, 1)
  let upscaleSurface = createOffscreenSurface(1, 1)
  let blurSurface = createOffscreenSurface(1, 1)
  let rafId = null

  function syncCanvasPosition() {
    syncWeatherCanvasToMapContainer(canvas, map)
    canvas.style.imageRendering = 'auto'
  }

  /**
   * Render temperature pixels at low resolution into fieldSurface.
   * NOTE: loop variable named `col` (not `px`) to avoid shadowing `pixels`.
   */
  function renderPixels(lowW, lowH, cssW, cssH) {
    const fctx = fieldSurface.getContext('2d', { willReadFrequently: true })
    if (!fctx) return

    const imageData = fctx.createImageData(lowW, lowH)
    const pixels = imageData.data   // Uint8ClampedArray — must not be shadowed
    const stepX = cssW / lowW
    const stepY = cssH / lowH

    for (let row = 0; row < lowH; row++) {
      const screenY = Math.min(cssH - 1, (row + 0.5) * stepY)
      for (let col = 0; col < lowW; col++) {
        const screenX = Math.min(cssW - 1, (col + 0.5) * stepX)
        const latlng = map.containerPointToLatLng([screenX, screenY])
        const temp = sampleTemperatureAtLatLng(
          sampleMatrix,
          sampleSize,
          latlng.lat,
          latlng.lng,
          bounds,
        )

        const i = (row * lowW + col) * 4

        if (temp == null || Number.isNaN(temp)) {
          pixels[i]     = 0
          pixels[i + 1] = 0
          pixels[i + 2] = 0
          pixels[i + 3] = 0
          continue
        }

        const lutIdx = temperatureToLutIndex(temp, lutMin, lutMax, lutSize)
        const o = lutIdx * 4
        pixels[i]     = Math.round(lut[o])
        pixels[i + 1] = Math.round(lut[o + 1])
        pixels[i + 2] = Math.round(lut[o + 2])
        pixels[i + 3] = Math.round(lut[o + 3])
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
    syncCanvasPosition()
    const cssW = canvas.width
    const cssH = canvas.height
    if (cssW <= 0 || cssH <= 0) return

    const lowW = Math.max(1, Math.round(cssW * RENDER_SCALE))
    const lowH = Math.max(1, Math.round(cssH * RENDER_SCALE))

    if (fieldSurface.width !== lowW || fieldSurface.height !== lowH) {
      fieldSurface = createOffscreenSurface(lowW, lowH)
    }
    if (upscaleSurface.width !== cssW || upscaleSurface.height !== cssH) {
      upscaleSurface = createOffscreenSurface(cssW, cssH)
      blurSurface    = createOffscreenSurface(cssW, cssH)
    }

    renderPixels(lowW, lowH, cssW, cssH)
    upscaleField(lowW, lowH, cssW, cssH)
    applyBlur(cssW, cssH)

    // Stamp blurred field onto the visible canvas
    canvas.width = cssW
    canvas.height = cssH
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

  return {
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
}
