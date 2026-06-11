import { lookupGridVector } from './lookupGridVector.js'

const PARTICLE_COUNT = 5000
const FADE_ALPHA = 0.92
/** Wind components are km/h (see createWindParticleOverlay). */
const SPEED_FACTOR = 0.00002

/**
 * Pure Canvas 2D wind particles (lat/lon stored, reprojected each frame).
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {object} options.header
 * @param {ArrayLike<number>} options.u — km/h
 * @param {ArrayLike<number>} options.v — km/h
 * @param {import('leaflet').Map} options.map
 * @param {() => { width: number, height: number }} options.getSize
 */
export function createWindParticles2D(canvas, { header, u, v, map, getSize }) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const particles = Array.from({ length: PARTICLE_COUNT }, () => {
    const maxAge = 40 + Math.floor(Math.random() * 80)
    return {
      lat: 0,
      lng: 0,
      age: Math.floor(Math.random() * maxAge),
      maxAge,
      prevX: 0,
      prevY: 0,
    }
  })

  let rafId = 0
  let running = false

  function randomInBounds(bounds) {
    return {
      lat: bounds.getSouth() + Math.random() * (bounds.getNorth() - bounds.getSouth()),
      lng: bounds.getWest() + Math.random() * (bounds.getEast() - bounds.getWest()),
    }
  }

  function respawn(p) {
    const pos = randomInBounds(map.getBounds())
    p.lat = pos.lat
    p.lng = pos.lng
    p.maxAge = 40 + Math.floor(Math.random() * 80)
    p.age = 0
    p.prevX = 0
    p.prevY = 0
  }

  function speedColorKmh(speedKmh) {
    if (speedKmh < 10) return 'rgba(20, 40, 120, 0.75)'
    if (speedKmh < 30) return 'rgba(0, 220, 255, 0.8)'
    if (speedKmh < 50) return 'rgba(0, 220, 100, 0.82)'
    if (speedKmh < 80) return 'rgba(255, 230, 0, 0.85)'
    if (speedKmh < 100) return 'rgba(255, 140, 0, 0.88)'
    return 'rgba(255, 40, 40, 0.9)'
  }

  function frame() {
    if (!running) return

    const size = getSize()
    const w = size.width
    const h = size.height
    if (w <= 0 || h <= 0) {
      rafId = requestAnimationFrame(frame)
      return
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`
    ctx.fillRect(0, 0, w, h)

    const bounds = map.getBounds()
    const origin = map.containerPointToLayerPoint([0, 0])

    for (const p of particles) {
      p.age += 1

      const wind = lookupGridVector(header, u, v, p.lat, p.lng)
      const ui = wind?.u ?? 0
      const vi = wind?.v ?? 0
      const speedKmh = Math.hypot(ui, vi)

      const latRad = (p.lat * Math.PI) / 180
      const cosLat = Math.max(0.15, Math.cos(latRad))
      p.lng += (ui * SPEED_FACTOR) / cosLat
      p.lat += vi * SPEED_FACTOR

      const offGrid =
        p.lat < bounds.getSouth() ||
        p.lat > bounds.getNorth() ||
        p.lng < bounds.getWest() ||
        p.lng > bounds.getEast()

      if (p.age >= p.maxAge || offGrid) {
        respawn(p)
        continue
      }

      const pt = map.latLngToLayerPoint([p.lat, p.lng])
      const x = pt.x - origin.x
      const y = pt.y - origin.y

      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) {
        respawn(p)
        continue
      }

      if (p.prevX !== 0 || p.prevY !== 0) {
        ctx.strokeStyle = speedColorKmh(speedKmh)
        ctx.lineWidth = 1.1
        ctx.beginPath()
        ctx.moveTo(p.prevX, p.prevY)
        ctx.lineTo(x, y)
        ctx.stroke()
      }

      p.prevX = x
      p.prevY = y
    }

    rafId = requestAnimationFrame(frame)
  }

  return {
    start() {
      if (running) return
      running = true
      for (const p of particles) respawn(p)
      const size = getSize()
      ctx.fillStyle = 'rgba(0, 0, 0, 1)'
      ctx.fillRect(0, 0, size.width, size.height)
      frame()
    },
    stop() {
      running = false
      cancelAnimationFrame(rafId)
    },
    resize() {
      const size = getSize()
      ctx.fillStyle = 'rgba(0, 0, 0, 1)'
      ctx.fillRect(0, 0, size.width, size.height)
      for (const p of particles) {
        p.prevX = 0
        p.prevY = 0
      }
    },
    destroy() {
      this.stop()
    },
  }
}
