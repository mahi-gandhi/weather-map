import { createWaveParticles2D } from './WaveParticles2D.js'

/**
 * Wave direction particles fixed to the map container (not overlayPane).
 * @param {HTMLCanvasElement} canvas
 * @param {import('leaflet').Map} map
 * @param {ArrayLike<number>} data
 */
export function createWaveParticleOverlay(canvas, map, data) {
  function syncCanvasSize() {
    const container = map.getContainer()
    const width = Math.max(1, container.offsetWidth)
    const height = Math.max(1, container.offsetHeight)
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.width = width
    canvas.height = height
    return { width, height }
  }

  function getSize() {
    const container = map.getContainer()
    return {
      width: Math.max(1, container.offsetWidth),
      height: Math.max(1, container.offsetHeight),
    }
  }

  const particles = createWaveParticles2D(canvas, {
    data,
    map,
    getSize,
  })

  const onMoveStart = () => {
    particles.pauseAndClear()
  }

  const onMoveEnd = () => {
    syncCanvasSize()
    particles.reinitialize()
    particles.start()
  }

  const onZoomStart = () => {
    particles.pauseAndClear()
  }

  const onResize = () => {
    syncCanvasSize()
    particles.reinitialize()
  }

  const onZoomEnd = () => {
    syncCanvasSize()
    particles.reinitialize()
    particles.start()
  }

  return {
    start() {
      syncCanvasSize()
      map.on('movestart', onMoveStart)
      map.on('moveend', onMoveEnd)
      map.on('zoomstart', onZoomStart)
      map.on('zoomend', onZoomEnd)
      map.on('resize', onResize)
      particles.start()
    },
    stop() {
      particles.stop()
    },
    destroy() {
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.off('zoomstart', onZoomStart)
      map.off('zoomend', onZoomEnd)
      map.off('resize', onResize)
      particles.destroy()
    },
  }
}
