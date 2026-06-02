import { lookupGridVector } from './lookupGridVector.js'

const PARTICLE_COUNT = 2500
const TRAIL_ALPHA = 0.12
const SPEED_SCALE = 0.00008

/**
 * Canvas 2D wind flow (no float textures). Fallback when regl particles fail.
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 */
export function createWindCanvasFlow(canvas, { header, u, v, map, getSize }) {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('2D canvas context unavailable')
  }

  const west = Math.min(header.lo1, header.lo2)
  const east = Math.max(header.lo1, header.lo2)
  const south = Math.min(header.la1, header.la2)
  const north = Math.max(header.la1, header.la2)

  const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    lng: west + Math.random() * (east - west),
    lat: south + Math.random() * (north - south),
    prevX: 0,
    prevY: 0,
  }))

  let rafId = 0
  let running = false

  function respawn(p) {
    p.lng = west + Math.random() * (east - west)
    p.lat = south + Math.random() * (north - south)
  }

  function windyColor(speedKmh) {
    if (speedKmh < 10) return `rgba(100, 180, 255, 0.65)`
    if (speedKmh < 30) return `rgba(0, 220, 255, 0.75)`
    if (speedKmh < 60) return `rgba(0, 255, 150, 0.8)`
    return `rgba(255, 220, 80, 0.85)`
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

    ctx.fillStyle = `rgba(26, 26, 46, ${TRAIL_ALPHA})`
    ctx.fillRect(0, 0, w, h)

    const origin = map.containerPointToLayerPoint([0, 0])

    for (const p of particles) {
      const wind = lookupGridVector(header, u, v, p.lat, p.lng)
      const ui = wind?.u ?? 0
      const vi = wind?.v ?? 0
      const speed = Math.hypot(ui, vi)

      p.lng += ui * SPEED_SCALE
      p.lat += vi * SPEED_SCALE

      if (p.lng < west || p.lng > east || p.lat < south || p.lat > north) {
        respawn(p)
        continue
      }

      const pt = map.latLngToLayerPoint([p.lat, p.lng])
      const x = pt.x - origin.x
      const y = pt.y - origin.y

      if (p.prevX !== 0 || p.prevY !== 0) {
        ctx.strokeStyle = windyColor(speed)
        ctx.lineWidth = 1.2
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
      const size = getSize()
      ctx.fillStyle = 'rgba(26, 26, 46, 1)'
      ctx.fillRect(0, 0, size.width, size.height)
      frame()
    },
    stop() {
      running = false
      cancelAnimationFrame(rafId)
    },
    resize() {
      const size = getSize()
      ctx.fillStyle = 'rgba(26, 26, 46, 1)'
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
