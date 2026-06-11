import { createWaveParticles2D } from './WaveParticles2D.js'

/**
 * Wave direction particles on Leaflet overlay pane.
 * @param {HTMLCanvasElement} canvas
 * @param {import('leaflet').Map} map
 * @param {ArrayLike<number>} data
 */
export function createWaveParticleOverlay(canvas, map, data) {
  function getSize() {
    const size = map.getSize()
    return { width: size.x, height: size.y }
  }

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

  const particles = createWaveParticles2D(canvas, {
    data,
    map,
    getSize,
  })

  const onMove = () => {
    syncCanvas()
  }

  const onResize = () => {
    syncCanvas()
    particles.resize()
  }

  const onZoomEnd = () => {
    syncCanvas()
    particles.reproject()
    particles.resize()
  }

  return {
    start() {
      syncCanvas()
      map.on('move', onMove)
      map.on('zoom', onMove)
      map.on('resize', onResize)
      map.on('zoomend', onZoomEnd)
      particles.start()
    },
    stop() {
      particles.stop()
    },
    destroy() {
      map.off('move', onMove)
      map.off('zoom', onMove)
      map.off('resize', onResize)
      map.off('zoomend', onZoomEnd)
      particles.destroy()
    },
  }
}
