import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

const NUM_PARTICLES = 3000
const MAX_AGE = 40
const SPEED = 2.5
const LINE_WIDTH = 1.5
const FADE = 0.05

export default function WaveParticles({ waveData }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const stateRef = useRef({})

  useEffect(() => {
    if (!map) return
    if (!waveData || !waveData.data || !waveData.data.length) return

    const data = waveData.data
    const container = map.getContainer()
    let W = container.offsetWidth
    let H = container.offsetHeight

    // Create canvas
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '450'
    map.getPanes().mapPane.appendChild(canvas)
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')

    // Wave height lookup — pure grid, no lat/lng in loop
    function getH(px, py) {
      const ll = map.containerPointToLatLng([px, py])
      const lon = ((ll.lng % 360) + 360) % 360
      const col = Math.floor(lon)
      const row = Math.floor(90 - ll.lat)
      if (row < 0 || row > 180 || col < 0 || col >= 360) return -1
      return data[row * 360 + col] || 0
    }

    // Color ramp: blue → teal → green → purple
    function color(h, alpha) {
      if (h < 0) return null
      const stops = [
        [0,   [20, 10, 60]],
        [1.0, [20, 80, 180]],
        [2.0, [0, 160, 180]],
        [3.5, [0, 200, 140]],
        [5.0, [80, 180, 80]],
        [7.0, [140, 80, 180]],
        [10,  [200, 60, 220]],
      ]
      if (h <= stops[0][0]) {
        const [r,g,b] = stops[0][1]
        return `rgba(${r},${g},${b},${alpha})`
      }
      if (h >= stops[stops.length-1][0]) {
        const [r,g,b] = stops[stops.length-1][1]
        return `rgba(${r},${g},${b},${alpha})`
      }
      for (let i = 1; i < stops.length; i++) {
        if (h <= stops[i][0]) {
          const t = (h - stops[i-1][0]) / (stops[i][0] - stops[i-1][0])
          const a = stops[i-1][1], b2 = stops[i][1]
          return `rgba(${Math.round(a[0]+(b2[0]-a[0])*t)},${Math.round(a[1]+(b2[1]-a[1])*t)},${Math.round(a[2]+(b2[2]-a[2])*t)},${alpha})`
        }
      }
    }

    // Curl noise in screen space
    function curl(x, y, t) {
      const s = 0.003
      const e = 1.0
      const pot = (px, py) =>
        Math.sin(px*s + t) * Math.cos(py*s*0.8) +
        Math.sin(px*s*0.5 - py*s*0.866 + t*0.7) * 0.5 +
        Math.cos(px*s*0.866 + py*s*0.5 + t*0.4) * 0.3
      return {
        vx: -(pot(x, y+e) - pot(x, y-e)) / (2*e),
        vy:  (pot(x+e, y) - pot(x-e, y)) / (2*e)
      }
    }

    // Spawn one particle
    function spawn() {
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        const h = getH(x, y)
        if (h > 0.05) {
          const c = curl(x, y, 0)
          return { x, y, vx: c.vx*SPEED, vy: c.vy*SPEED, age: Math.floor(Math.random()*MAX_AGE) }
        }
      }
      return null
    }

    // Init particles
    let particles = []
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const p = spawn()
      if (p) particles.push(p)
    }

    // Animate
    let frame = 0
    let rafId = null

    function animate() {
      rafId = requestAnimationFrame(animate)
      frame++
      const t = frame * 0.004

      // Fade trails
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0,0,0,${FADE})`
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]
        const c = curl(p.x, p.y, t)
        p.vx = p.vx * 0.85 + c.vx * SPEED * 0.15
        p.vy = p.vy * 0.85 + c.vy * SPEED * 0.15
        const nx = p.x + p.vx
        const ny = p.y + p.vy
        p.age++

        if (nx < 0 || nx >= W || ny < 0 || ny >= H || p.age > MAX_AGE) {
          const np = spawn()
          if (np) particles[i] = np
          continue
        }

        const h = getH(nx, ny)
        if (h < 0.05) {
          const np = spawn()
          if (np) particles[i] = np
          continue
        }

        const life = Math.sin((p.age / MAX_AGE) * Math.PI)
        const col = color(h, life * 0.85)
        if (!col) continue

        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.strokeStyle = col
        ctx.lineWidth = LINE_WIDTH
        ctx.lineCap = 'round'
        ctx.stroke()

        p.x = nx
        p.y = ny
      }
    }

    rafId = requestAnimationFrame(animate)
    stateRef.current.rafId = rafId

    // On map move — pause and restart
    function onMoveStart() {
      cancelAnimationFrame(stateRef.current.rafId)
      ctx.clearRect(0, 0, W, H)
    }
    function onMoveEnd() {
      W = container.offsetWidth
      H = container.offsetHeight
      canvas.width = W
      canvas.height = H
      particles = []
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const p = spawn()
        if (p) particles.push(p)
      }
      frame = 0
      stateRef.current.rafId = requestAnimationFrame(animate)
    }

    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    map.on('zoomend', onMoveEnd)

    return () => {
      cancelAnimationFrame(stateRef.current.rafId)
      canvas.remove()
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.off('zoomend', onMoveEnd)
    }
  }, [map, waveData])

  return null
}
