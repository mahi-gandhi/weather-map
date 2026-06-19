import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { GRID_COLS } from '../lib/waveStaticGrid.js'
import { sampleWave, waveColor } from '../lib/wave-utils.js'

const NUM_PARTICLES = 9000
const MAX_AGE = 55
const SPEED = 2.2
const LINE_WIDTH = 2.0
const FADE = 0.045
const CELL = 6

export default function WaveParticles({ waveData }) {
  const map = useMap()
  const rafRef = useRef(null)

  useEffect(() => {
    if (!map || !waveData?.data?.length || !waveData?.landMask) return
    const data = waveData.data
    const landMask = waveData.landMask

    const container = map.getContainer()
    let W = container.offsetWidth
    let H = container.offsetHeight

    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '450'
    map.getPanes().mapPane.appendChild(canvas)
    const ctx = canvas.getContext('2d')

    let heightCells, cellCols, cellRows

    function isOceanCell(row, col) {
      return landMask[row * GRID_COLS + col] === 0
    }

    function isOceanAtLatLng(lat, lng) {
      if (lat > 85 || lat < -85) return false
      const row = Math.floor(90 - lat)
      const col = Math.floor(((lng % 360) + 360) % 360)
      if (row < 0 || row > 180 || col < 0 || col >= GRID_COLS) return false
      return isOceanCell(row, col)
    }

    function buildGrids() {
      cellCols = Math.ceil(W / CELL)
      cellRows = Math.ceil(H / CELL)
      heightCells = new Float32Array(cellCols * cellRows)

      const bounds = map.getBounds()
      const west = bounds.getWest()
      const east = bounds.getEast()

      for (let r = 0; r < cellRows; r++) {
        for (let c = 0; c < cellCols; c++) {
          const px = c * CELL + CELL / 2
          const py = r * CELL + CELL / 2
          const ll = map.containerPointToLatLng([px, py])

          let lng = ll.lng
          while (lng < west) lng += 360
          while (lng > west + 360) lng -= 360
          if (lng > east) continue
          if (!isOceanAtLatLng(ll.lat, lng)) continue

          const v = sampleWave(data, landMask, ll.lat, lng)
          if (v < 0) continue

          heightCells[r * cellCols + c] = v
        }
      }
    }

    function isOceanPx(px, py) {
      if (px < 0 || px >= W || py < 0 || py >= H) return false
      const ll = map.containerPointToLatLng([px, py])
      return isOceanAtLatLng(ll.lat, ll.lng)
    }

    function heightAt(px, py) {
      const c = Math.min(Math.max(Math.floor(px / CELL), 0), cellCols - 1)
      const r = Math.min(Math.max(Math.floor(py / CELL), 0), cellRows - 1)
      return heightCells[r * cellCols + c] || 0.3
    }

    function curl(x, y, t) {
      const s = 0.0028
      const e = 1.0
      const pot = (px, py) =>
        Math.sin(px * s + t) * Math.cos(py * s * 0.8) +
        Math.sin(px * s * 0.5 - py * s * 0.866 + t * 0.7) * 0.55 +
        Math.cos(px * s * 0.85 + py * s * 0.5 + t * 0.4) * 0.35
      return {
        vx: -(pot(x, y + e) - pot(x, y - e)) / (2 * e),
        vy: (pot(x + e, y) - pot(x - e, y)) / (2 * e),
      }
    }

    function spawn() {
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * W
        const y = Math.random() * H
        if (isOceanPx(x, y)) {
          const c = curl(x, y, 0)
          return {
            x,
            y,
            vx: c.vx * SPEED,
            vy: c.vy * SPEED,
            age: Math.floor(Math.random() * MAX_AGE),
          }
        }
      }
      return null
    }

    let particles = []
    function initParticles() {
      particles = []
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const p = spawn()
        if (p) particles.push(p)
      }
    }

    buildGrids()
    initParticles()

    let frame = 0
    let lastTime = performance.now()
    let fpsFrameCount = 0
    const fpsDisplay = document.createElement('div')
    fpsDisplay.style.cssText =
      'position:fixed;top:10px;left:10px;background:rgba(0,0,0,0.7);color:#0f0;padding:6px 10px;font-family:monospace;font-size:14px;z-index:9999;border-radius:4px;'
    document.body.appendChild(fpsDisplay)

    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      frame++
      fpsFrameCount++
      const now = performance.now()
      if (now - lastTime >= 1000) {
        fpsDisplay.textContent = `FPS: ${fpsFrameCount} | Particles: ${particles.length}`
        fpsFrameCount = 0
        lastTime = now
      }
      const t = frame * 0.0035

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

        if (!isOceanPx(nx, ny) || p.age > MAX_AGE) {
          const np = spawn()
          if (np) particles[i] = np
          continue
        }

        const h = heightAt(p.x, p.y)
        const life = Math.sin((p.age / MAX_AGE) * Math.PI)
        const [r, g, b] = waveColor(h)

        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(nx, ny)
        ctx.strokeStyle = `rgba(${r},${g},${b},${(life * 0.95).toFixed(2)})`
        ctx.lineWidth = LINE_WIDTH
        ctx.lineCap = 'round'
        ctx.stroke()

        p.x = nx
        p.y = ny
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    function onMoveStart() {
      cancelAnimationFrame(rafRef.current)
      ctx.clearRect(0, 0, W, H)
    }
    function onMoveEnd() {
      W = container.offsetWidth
      H = container.offsetHeight
      canvas.width = W
      canvas.height = H
      buildGrids()
      initParticles()
      frame = 0
      rafRef.current = requestAnimationFrame(animate)
    }

    map.on('movestart', onMoveStart)
    map.on('moveend', onMoveEnd)
    map.on('zoomend', onMoveEnd)

    return () => {
      cancelAnimationFrame(rafRef.current)
      fpsDisplay.remove()
      canvas.remove()
      map.off('movestart', onMoveStart)
      map.off('moveend', onMoveEnd)
      map.off('zoomend', onMoveEnd)
    }
  }, [map, waveData])

  return null
}
