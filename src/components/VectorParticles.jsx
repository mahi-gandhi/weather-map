import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { colorForSpeed } from '../lib/ecmwfColor.js'

export default function VectorParticles({ ecmwfLayer, colorScheme, oceanMask }) {
  const map = useMap()
  const rafRef = useRef(null)

  useEffect(() => {
    const uField = ecmwfLayer?.[0]?.data
    const vField = ecmwfLayer?.[1]?.data
    if (!map || !uField || !vField) return

    const parent = map.getContainer()
    let W = parent.offsetWidth
    let H = parent.offsetHeight
    parent.style.position = 'relative'

    const canvas = document.createElement('canvas')
    canvas.setAttribute('data-weather-canvas', 'true')
    canvas.width = W
    canvas.height = H
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '450'
    parent.appendChild(canvas)
    const ctx = canvas.getContext('2d')

    function isOcean(px, py) {
      if (px < 0 || px >= W || py < 0 || py >= H) return false
      const ll = map.containerPointToLatLng([px, py])
      const lat = ll.lat
      const lng = ll.lng
      if (lng < -180 || lng > 180) return false
      if (lat > 85 || lat < -85) return false
      const lon = ((lng % 360) + 360) % 360
      const col = Math.floor(lon)
      const row = Math.floor(90 - lat)
      if (row < 0 || row > 180 || col < 0 || col >= 360) return false
      const idx = row * 360 + col

      if (oceanMask && oceanMask[idx] === 0) return true
      const U = uField[idx]
      const V = vField[idx]
      return Math.sqrt(U * U + V * V) > 0.01
    }

    function getVector(px, py) {
      if (px < 0 || px >= W || py < 0 || py >= H) return null
      if (!isOcean(px, py)) return null
      const ll = map.containerPointToLatLng([px, py])
      const lon = ((ll.lng % 360) + 360) % 360
      const col = Math.floor(lon) % 360
      const row = Math.floor(90 - ll.lat)
      if (row < 0 || row > 180 || col < 0 || col >= 360) return null

      const idx = row * 360 + col
      const u = uField[idx]
      const v = vField[idx]
      if (u == null || v == null) return null

      const vx = u
      const vy = -v
      const speed = Math.sqrt(vx * vx + vy * vy)
      if (speed < 0.01) return null
      return { vx, vy, speed }
    }

    function strokeColor(speed, alpha) {
      const [r, g, b] = colorForSpeed(speed, colorScheme)
      return `rgba(${r},${g},${b},${alpha.toFixed(2)})`
    }

    function spawn() {
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        if (!isOcean(x, y)) continue
        const v = getVector(x, y)
        if (!v) continue
        const mag = Math.sqrt(v.vx * v.vx + v.vy * v.vy) || 1
        const step = 1.2
        return {
          x,
          y,
          vx: (v.vx / mag) * step,
          vy: (v.vy / mag) * step,
          speed: v.speed,
          age: Math.floor(Math.random() * 50),
        }
      }
      return null
    }

    const NUM = 1800
    const MAX_AGE = 44
    const FADE = 0.07
    const LINE_W = 1.8
    const TURN_BLEND = 0.4
    const STEP = 1.4

    let particles = []
    function init() {
      particles = []
      for (let i = 0; i < NUM; i++) {
        const p = spawn()
        if (p) particles.push(p)
      }
    }
    init()

    function scheduleNextFrame() {
      if (!window.__weatherAnimFrames) window.__weatherAnimFrames = []
      const prev = rafRef.current
      const id = requestAnimationFrame(animate)
      if (prev != null) {
        const i = window.__weatherAnimFrames.indexOf(prev)
        if (i >= 0) window.__weatherAnimFrames.splice(i, 1)
      }
      window.__weatherAnimFrames.push(id)
      rafRef.current = id
    }

    function animate() {
      scheduleNextFrame()

      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0,0,0,${FADE})`
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const field = getVector(p.x, p.y)
        if (!field) {
          const np = spawn()
          if (np) particles[i] = np
          continue
        }

        const mag = Math.sqrt(field.vx * field.vx + field.vy * field.vy) || 1
        const tvx = (field.vx / mag) * STEP
        const tvy = (field.vy / mag) * STEP
        p.vx = p.vx * (1 - TURN_BLEND) + tvx * TURN_BLEND
        p.vy = p.vy * (1 - TURN_BLEND) + tvy * TURN_BLEND
        p.speed = field.speed

        const nx = p.x + p.vx
        const ny = p.y + p.vy
        p.age++

        if (!getVector(nx, ny) || p.age > MAX_AGE) {
          const np = spawn()
          if (np) particles[i] = np
          continue
        }

        const life = Math.sin((p.age / MAX_AGE) * Math.PI)
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.strokeStyle = strokeColor(p.speed, life * 0.45)
        ctx.lineWidth = LINE_W
        ctx.lineCap = 'round'
        ctx.stroke()

        p.x = nx
        p.y = ny
      }
    }

    scheduleNextFrame()

    function onMoveStart() {
      cancelAnimationFrame(rafRef.current)
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    function onMoveEnd() {
      W = parent.offsetWidth
      H = parent.offsetHeight
      canvas.width = W
      canvas.height = H
      init()
      scheduleNextFrame()
    }

    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    map.on('zoomstart', onMoveStart)
    map.on('zoomend', onMoveEnd)

    return () => {
      cancelAnimationFrame(rafRef.current)
      if (window.__weatherAnimFrames && rafRef.current != null) {
        const i = window.__weatherAnimFrames.indexOf(rafRef.current)
        if (i >= 0) window.__weatherAnimFrames.splice(i, 1)
      }
      try {
        canvas.remove()
      } catch (e) {}
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.off('zoomstart', onMoveStart)
      map.off('zoomend', onMoveEnd)
    }
  }, [colorScheme, ecmwfLayer, map, oceanMask])

  return null
}
