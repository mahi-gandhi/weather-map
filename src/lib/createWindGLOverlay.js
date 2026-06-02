import { WindGL } from './WindGL.js'
import { encodeWindTexture } from './encodeWindTexture.js'

function containerToNdc(x, y, width, height) {
  return [(x / width) * 2 - 1, 1 - (y / height) * 2]
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('leaflet').Map} map
 * @param {object} windGrid — from fetchGFSGrid
 */
export function createWindGLOverlay(canvas, map, windGrid) {
  const { header, u, v, nx, ny } = windGrid
  const windGL = new WindGL(canvas)

  const encoded = encodeWindTexture(u, v, nx, ny)
  windGL.setWind(encoded.imageData, encoded.uMin, encoded.uMax)

  let rafId = null
  let running = false

  const north = Math.max(header.la1, header.la2)
  const south = Math.min(header.la1, header.la2)
  const west = Math.min(header.lo1, header.lo2)
  const east = Math.max(header.lo1, header.lo2)

  function syncCanvas() {
    const size = map.getSize()
    const topLeft = map.containerPointToLayerPoint([0, 0])
    canvas.style.left = `${-topLeft.x}px`
    canvas.style.top = `${-topLeft.y}px`
    canvas.style.width = `${size.x}px`
    canvas.style.height = `${size.y}px`
    canvas.width = Math.max(1, size.x)
    canvas.height = Math.max(1, size.y)
    windGL.resize(size.x, size.y)
  }

  function updateNdcCorners() {
    const size = map.getSize()
    const w = size.x
    const h = size.y

    const nw = map.latLngToContainerPoint([north, west])
    const ne = map.latLngToContainerPoint([north, east])
    const sw = map.latLngToContainerPoint([south, west])
    const se = map.latLngToContainerPoint([south, east])

    windGL.setNdcCorners({
      nw: containerToNdc(nw.x, nw.y, w, h),
      ne: containerToNdc(ne.x, ne.y, w, h),
      sw: containerToNdc(sw.x, sw.y, w, h),
      se: containerToNdc(se.x, se.y, w, h),
    })
  }

  function loop() {
    if (!running) return
    syncCanvas()
    updateNdcCorners()
    windGL.frame()
    rafId = requestAnimationFrame(loop)
  }

  return {
    start() {
      if (running) return
      running = true
      syncCanvas()
      updateNdcCorners()
      map.on('move', updateNdcCorners)
      map.on('zoom', updateNdcCorners)
      map.on('resize', syncCanvas)
      rafId = requestAnimationFrame(loop)
      console.info('[WindGL] particle overlay active', windGrid.source)
    },
    resize() {
      syncCanvas()
      updateNdcCorners()
    },
    redraw() {
      updateNdcCorners()
    },
    destroy() {
      running = false
      if (rafId != null) cancelAnimationFrame(rafId)
      map.off('move', updateNdcCorners)
      map.off('zoom', updateNdcCorners)
      map.off('resize', syncCanvas)
      windGL.destroy()
    },
  }
}
