import { isOcean, sampleGlobalWaveAt } from './waveStaticGrid.js'
import { sampleWaveParticleRgba } from './waveColorRamp.js'
import { swellFlowDelta } from './waveSwellDirection.js'

const PARTICLE_COUNT = 1200
const FADE_ALPHA = 0.022
const SPEED_FACTOR = 0.004
const TAIL_LENGTH = 240
const OCEAN_SPAWN_ATTEMPTS = 100

/**
 * Animated wave-direction particles (latitude-based swell flow).
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {ArrayLike<number>} options.data
 * @param {import('leaflet').Map} options.map
 * @param {() => { width: number, height: number }} options.getSize
 */
export function createWaveParticles2D(canvas, { data, map, getSize }) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const particles = Array.from({ length: PARTICLE_COUNT }, () => {
    const maxAge = 120 + Math.floor(Math.random() * 121)
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

  function randomOceanParticle() {
    const { width: W, height: H } = getSize()
    let attempts = 0
    while (attempts < OCEAN_SPAWN_ATTEMPTS) {
      const px = Math.random() * W
      const py = Math.random() * H
      const ll = map.containerPointToLatLng([px, py])
      if (isOcean(ll.lat, ll.lng, data)) {
        return { lat: ll.lat, lng: ll.lng, ok: true }
      }
      attempts++
    }
    return { ok: false }
  }

  function respawn(p) {
    const pos = randomOceanParticle()
    if (!pos.ok) {
      p.lat = 0
      p.lng = 0
      p.prevX = -10
      p.prevY = -10
      p.age = TAIL_LENGTH
      return
    }
    p.lat = pos.lat
    p.lng = pos.lng
    p.maxAge = 120 + Math.floor(Math.random() * 121)
    p.age = 0
    p.prevX = 0
    p.prevY = 0
  }

  function clearCanvas() {
    const size = getSize()
    ctx.clearRect(0, 0, size.width, size.height)
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

    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`
    ctx.fillRect(0, 0, w, h)
    ctx.globalCompositeOperation = 'source-over'

    const bounds = map.getBounds()

    for (const p of particles) {
      p.age += 1

      if (!isOcean(p.lat, p.lng, data)) {
        respawn(p)
        continue
      }

      const startLat = p.lat
      const startLng = p.lng
      const height = sampleGlobalWaveAt(startLat, startLng, data) ?? 0

      const { dlat, dlng } = swellFlowDelta(p.lat, p.lng, SPEED_FACTOR)
      p.lat += dlat
      p.lng += dlng

      if (!isOcean(p.lat, p.lng, data) || !isOcean(startLat, startLng, data)) {
        respawn(p)
        continue
      }

      const offGrid =
        p.lat < bounds.getSouth() ||
        p.lat > bounds.getNorth() ||
        p.lng < bounds.getWest() ||
        p.lng > bounds.getEast()

      if (p.age >= p.maxAge || offGrid) {
        respawn(p)
        continue
      }

      const pt = map.latLngToContainerPoint([p.lat, p.lng])
      const x = pt.x
      const y = pt.y

      if (x < -20 || x > w + 20 || y < -20 || y > h + 20) {
        respawn(p)
        continue
      }

      const hasTrail = p.prevX !== 0 || p.prevY !== 0
      if (hasTrail && p.prevX >= 0 && p.prevY >= 0) {
        ctx.strokeStyle = sampleWaveParticleRgba(height)
        ctx.lineWidth = 0.8
        ctx.lineCap = 'round'
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
      clearCanvas()
      frame()
    },
    stop() {
      running = false
      cancelAnimationFrame(rafId)
    },
    pauseAndClear() {
      running = false
      cancelAnimationFrame(rafId)
      clearCanvas()
    },
    reinitialize() {
      for (const p of particles) respawn(p)
      for (const p of particles) {
        p.prevX = 0
        p.prevY = 0
      }
      clearCanvas()
    },
    resize() {
      clearCanvas()
      for (const p of particles) {
        p.prevX = 0
        p.prevY = 0
      }
    },
    reproject() {
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
