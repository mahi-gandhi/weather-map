import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

export default function WaveParticles({ waveData, ecmwfWave }) {
  const map = useMap()
  const rafRef = useRef(null)

  useEffect(() => {
    if (!map || (!ecmwfWave && !waveData?.data?.length)) return
    const data = waveData?.data
    const landMask = waveData?.landMask

    const container = map.getContainer()
    let W = container.offsetWidth
    let H = container.offsetHeight

    container.style.position = 'relative'

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '450'
    container.appendChild(canvas)
    const ctx = canvas.getContext('2d')

    function isOcean(px, py) {
      if (px < 0 || px >= W || py < 0 || py >= H) return false
      const ll = map.containerPointToLatLng([px, py])
      const lat = ll.lat
      let lng = ll.lng
      if (lng < -180 || lng > 180) return false
      if (lat > 85 || lat < -85) return false
      const lon = ((lng % 360) + 360) % 360
      const col = Math.floor(lon)
      const row = Math.floor(90 - lat)
      if (row < 0 || row > 180 || col < 0 || col >= 360) return false
      if (landMask && landMask[row * 360 + col] === 1) return false
      if (ecmwfWave) {
        const idx = row * 360 + col
        const U = ecmwfWave[0]?.data?.[idx]
        const V = ecmwfWave[1]?.data?.[idx]
        if (U == null || V == null) return false
        return Math.sqrt(U * U + V * V) > 0.05
      }
      return (data?.[row * 360 + col] ?? 0) > 0.05
    }

    function getHeight(px, py) {
      const ll = map.containerPointToLatLng([px, py])
      const lon = ((ll.lng % 360) + 360) % 360
      const col = Math.floor(lon)
      const row = Math.floor(90 - ll.lat)
      if (row < 0 || row > 180 || col < 0 || col >= 360) return 0.5
      if (ecmwfWave) {
        const idx = row * 360 + col
        const U = ecmwfWave[0]?.data?.[idx]
        const V = ecmwfWave[1]?.data?.[idx]
        if (U == null || V == null) return 0.5
        return Math.sqrt(U * U + V * V)
      }
      return data?.[row * 360 + col] || 0.5
    }

    function curl(x, y, t) {
      const e = 1.5

      const nx = (x / W) * 10
      const ny = (y / H) * 10

      const f = (px, py) =>
        Math.sin(px * 0.8 + t * 0.6) * Math.cos(py * 0.6) * 1.2 +
        Math.sin(px * 1.8 - py * 1.4 + t * 0.5) * 0.8 +
        Math.cos(px * 2.2 + py * 0.9 + t * 0.4) * 0.6 +
        Math.sin(px * 3.5 - py * 2.1 + t * 0.3) * 0.3 +
        Math.cos(px * 1.2 + py * 3.3 - t * 0.2) * 0.25

      const ne = (e / W) * 10
      return {
        vx: -(f(nx, ny + ne) - f(nx, ny - ne)) / (2 * ne),
        vy: (f(nx + ne, ny) - f(nx - ne, ny)) / (2 * ne),
      }
    }

    function getRealDirection(px, py) {
      if (!ecmwfWave) return null
      const ll = map.containerPointToLatLng([px, py])
      const lat = ll.lat
      const lon = ((ll.lng % 360) + 360) % 360

      const col = Math.floor(lon) % 360
      const row = Math.floor(90 - lat)
      if (row < 0 || row > 180 || col < 0 || col >= 360) return null

      const idx = row * 360 + col
      const U = ecmwfWave[0]?.data?.[idx]
      const V = ecmwfWave[1]?.data?.[idx]

      if (U == null || V == null) return null
      if (!U && !V) return null

      return {
        vx: U,
        vy: -V,
      }
    }

    function particleColor(h, alpha) {
      const stops = [
        [0, [120, 170, 220]],
        [1.5, [80, 200, 200]],
        [3.0, [100, 220, 140]],
        [5.0, [220, 200, 80]],
        [7.0, [220, 120, 180]],
        [10, [200, 80, 220]],
      ]
      let c = stops[0][1]
      for (let i = 1; i < stops.length; i++) {
        if (h <= stops[i][0]) {
          const t = (h - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])
          const a = stops[i - 1][1]
          const b = stops[i][1]
          c = [
            Math.round(a[0] + (b[0] - a[0]) * t),
            Math.round(a[1] + (b[1] - a[1]) * t),
            Math.round(a[2] + (b[2] - a[2]) * t),
          ]
          break
        }
        c = stops[i][1]
      }
      return `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(2)})`
    }

    function spawn() {
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        if (isOcean(x, y)) {
          const c = curl(x, y, 0)
          const mag = Math.sqrt(c.vx * c.vx + c.vy * c.vy) || 1
          return {
            x,
            y,
            vx: (c.vx / mag) * 3,
            vy: (c.vy / mag) * 3,
            age: Math.floor(Math.random() * 50),
          }
        }
      }
      return null
    }

    const NUM = 1800
    const MAX_AGE = 40
    const FADE = 0.07
    const LINE_W = 2.0
    const SPEED_SCALE = 0.3

    let particles = []
    function init() {
      particles = []
      for (let i = 0; i < NUM; i++) {
        const p = spawn()
        if (p) particles.push(p)
      }
    }
    init()

    let frame = 0
    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      frame++
      const t = frame * 0.004

      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0,0,0,${FADE})`
      ctx.fillRect(0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        const realDir = getRealDirection(p.x, p.y)
        let tvx
        let tvy

        if (realDir) {
          const mag = Math.sqrt(realDir.vx * realDir.vx + realDir.vy * realDir.vy) || 1
          tvx = (realDir.vx / mag) * SPEED_SCALE * 3
          tvy = (realDir.vy / mag) * SPEED_SCALE * 3
        } else {
          const c = curl(p.x, p.y, t)
          tvx = c.vx * SPEED_SCALE
          tvy = c.vy * SPEED_SCALE
        }

        p.vx = p.vx * 0.60 + tvx * 0.40
        p.vy = p.vy * 0.60 + tvy * 0.40

        const nx = p.x + p.vx
        const ny = p.y + p.vy
        p.age++

        if (!isOcean(nx, ny) || p.age > MAX_AGE) {
          const np = spawn()
          if (np) particles[i] = np
          continue
        }

        const life = Math.sin((p.age / MAX_AGE) * Math.PI)
        const h = getHeight(p.x, p.y)

        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.strokeStyle = particleColor(h, life * 0.35)
        ctx.lineWidth = LINE_W
        ctx.lineCap = 'round'
        ctx.stroke()

        p.x = nx
        p.y = ny
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    function onMoveStart() {
      cancelAnimationFrame(rafRef.current)
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    function onMoveEnd() {
      W = container.offsetWidth
      H = container.offsetHeight
      canvas.width = W
      canvas.height = H
      frame = 0
      init()
      rafRef.current = requestAnimationFrame(animate)
    }

    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    map.on('zoomstart', onMoveStart)
    map.on('zoomend', onMoveEnd)

    return () => {
      cancelAnimationFrame(rafRef.current)
      canvas.remove()
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.off('zoomstart', onMoveStart)
      map.off('zoomend', onMoveEnd)
    }
  }, [ecmwfWave, map, waveData])

  return null
}
