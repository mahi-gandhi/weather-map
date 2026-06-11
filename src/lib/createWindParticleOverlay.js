import { createWindParticles2D } from './WindParticles2D.js'

/**
 * Canvas 2D wind particles on Leaflet overlay pane.
 * @param {HTMLCanvasElement} canvas
 * @param {import('leaflet').Map} map
 * @param {object} windGrid — gfsMeta from fetchGFSGrid
 */
export function createWindParticleOverlay(canvas, map, windGrid) {
  const { header, u, v, nx, ny } = windGrid

  const gridHeader = {
    ...header,
    nx: nx ?? header.nx,
    ny: ny ?? header.ny,
  }

  const count = u.length
  const uKmh = new Float32Array(count)
  const vKmh = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    uKmh[i] = (u[i] ?? 0) * 3.6
    vKmh[i] = (v[i] ?? 0) * 3.6
  }

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

  const particles = createWindParticles2D(canvas, {
    header: gridHeader,
    u: uKmh,
    v: vKmh,
    map,
    getSize,
  })

  const onMapChange = () => {
    syncCanvas()
    particles.resize()
  }

  return {
    start() {
      syncCanvas()
      map.on('move', onMapChange)
      map.on('zoom', onMapChange)
      map.on('resize', onMapChange)
      particles.start()
      console.info('[WindParticles] Canvas 2D overlay active', windGrid.source)
    },
    resize() {
      syncCanvas()
      particles.resize()
    },
    redraw() {
      syncCanvas()
      particles.resize()
    },
    destroy() {
      map.off('move', onMapChange)
      map.off('zoom', onMapChange)
      map.off('resize', onMapChange)
      particles.destroy()
    },
  }
}
