import { valueToLutIndex } from './colorLut.js'

/**
 * Geo-aligned smooth field overlay (DPR-aware, bilinear sampling, blur, LUT colors).
 * @param {HTMLCanvasElement} canvas
 * @param {import('leaflet').Map} map
 * @param {object} options
 * @param {(lat: number, lng: number) => number | null} options.getValueAtLatLng
 * @param {Uint8ClampedArray} options.lut
 * @param {number} options.lutMin
 * @param {number} options.lutMax
 * @param {number} [options.minVisible]
 * @param {number} [options.opacity]
 * @param {number} [options.pixelStep]
 */
export function createSmoothCanvasOverlay(canvas, map, options) {
  const {
    getValueAtLatLng,
    lut,
    lutMin,
    lutMax,
    minVisible = 0,
    opacity = 0.75,
    pixelStep = 2,
  } = options

  const workCanvas = document.createElement('canvas')
  let rafId = null

  function syncCanvasPosition() {
    const size = map.getSize()
    const topLeft = map.containerPointToLayerPoint([0, 0])
    canvas.style.left = `${-topLeft.x}px`
    canvas.style.top = `${-topLeft.y}px`
    canvas.style.width = `${size.x}px`
    canvas.style.height = `${size.y}px`
  }

  function draw() {
    const size = map.getSize()
    const cssW = size.x
    const cssH = size.y
    if (cssW <= 0 || cssH <= 0) return

    syncCanvasPosition()

    const dpr = window.devicePixelRatio || 1
    workCanvas.width = cssW
    workCanvas.height = cssH

    const wctx = workCanvas.getContext('2d', { willReadFrequently: true })
    if (!wctx) return

    const imageData = wctx.createImageData(cssW, cssH)
    const px = imageData.data

    for (let py = 0; py < cssH; py += pixelStep) {
      for (let pxX = 0; pxX < cssW; pxX += pixelStep) {
        const latlng = map.containerPointToLatLng([pxX, py])
        const value = getValueAtLatLng(latlng.lat, latlng.lng)

        let r = 0
        let g = 0
        let b = 0
        let a = 0

        if (
          value != null &&
          !Number.isNaN(value) &&
          value >= minVisible
        ) {
          const idx = valueToLutIndex(value, lutMin, lutMax)
          const o = idx * 4
          r = lut[o]
          g = lut[o + 1]
          b = lut[o + 2]
          a = lut[o + 3]
        }

        for (let dy = 0; dy < pixelStep && py + dy < cssH; dy++) {
          for (let dx = 0; dx < pixelStep && pxX + dx < cssW; dx++) {
            const i = ((py + dy) * cssW + (pxX + dx)) * 4
            px[i] = r
            px[i + 1] = g
            px[i + 2] = b
            px[i + 3] = a
          }
        }
      }
    }

    wctx.putImageData(imageData, 0, 0)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = Math.round(cssW * dpr)
    canvas.height = Math.round(cssH * dpr)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)
    ctx.globalAlpha = opacity
    ctx.globalCompositeOperation = 'source-over'
    ctx.filter = 'blur(8px)'
    ctx.drawImage(workCanvas, 0, 0)
    ctx.filter = 'none'
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
      map.on('move', onMapChange)
      map.on('zoom', onMapChange)
      map.on('resize', onMapChange)
    },
    resize: scheduleDraw,
    redraw: scheduleDraw,
    destroy() {
      if (rafId != null) cancelAnimationFrame(rafId)
      map.off('move', onMapChange)
      map.off('zoom', onMapChange)
      map.off('resize', onMapChange)
      const ctx = canvas.getContext('2d')
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    },
  }
}
