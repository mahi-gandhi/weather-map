import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

const MIN_LEVEL = 960
const MAX_LEVEL = 1040
const STEP = 4
const LABEL_STEP = 8

function scalarAt(field, row, col) {
  if (row < 0 || row > 180 || col < 0 || col >= 360) return null
  const idx = row * 360 + col
  const pa = field[idx]
  if (pa == null) return null
  return pa / 100
}

function cellSegments(tl, tr, br, bl, level) {
  const edges = []
  const topCross = (tl - level) * (tr - level) < 0
  const rightCross = (tr - level) * (br - level) < 0
  const bottomCross = (bl - level) * (br - level) < 0
  const leftCross = (tl - level) * (bl - level) < 0

  const safeLerp = (a, b) => {
    const d = b - a
    if (!Number.isFinite(d) || d === 0) return 0.5
    return (level - a) / d
  }

  if (topCross) edges.push({ side: 'top', t: safeLerp(tl, tr) })
  if (rightCross) edges.push({ side: 'right', t: safeLerp(tr, br) })
  if (bottomCross) edges.push({ side: 'bottom', t: safeLerp(bl, br) })
  if (leftCross) edges.push({ side: 'left', t: safeLerp(tl, bl) })

  if (edges.length < 2) return []
  if (edges.length === 2) return [[edges[0], edges[1]]]
  if (edges.length === 4) return [[edges[0], edges[1]], [edges[2], edges[3]]]
  return []
}

function edgeToLatLng(row, col, edge) {
  if (edge.side === 'top') return [90 - row, col + edge.t]
  if (edge.side === 'right') return [90 - (row + edge.t), col + 1]
  if (edge.side === 'bottom') return [90 - (row + 1), col + edge.t]
  return [90 - (row + edge.t), col]
}

export default function PressureCanvas({ ecmwfPressure }) {
  const map = useMap()

  useEffect(() => {
    const pressureField = Array.isArray(ecmwfPressure)
      ? ecmwfPressure?.[0]?.data
      : ecmwfPressure?.data
    if (!map || !pressureField) return

    const container = map.getContainer()
    container.style.position = 'relative'

    const canvas = document.createElement('canvas')
    canvas.setAttribute('data-weather-canvas', 'true')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '400'
    container.appendChild(canvas)
    const ctx = canvas.getContext('2d')

    function project(lat, lng) {
      const p = map.latLngToContainerPoint([lat, lng])
      return [p.x, p.y]
    }

    function draw() {
      const W = container.offsetWidth
      const H = container.offsetHeight
      canvas.width = W
      canvas.height = H
      ctx.clearRect(0, 0, W, H)
      ctx.lineWidth = 1.2
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'

      for (let level = MIN_LEVEL; level <= MAX_LEVEL; level += STEP) {
        const segments = []
        for (let row = 0; row < 180; row++) {
          for (let col = 0; col < 360; col++) {
            const tl = scalarAt(pressureField, row, col)
            const tr = scalarAt(pressureField, row, col + 1)
            const br = scalarAt(pressureField, row + 1, col + 1)
            const bl = scalarAt(pressureField, row + 1, col)
            if (
              tl == null ||
              tr == null ||
              br == null ||
              bl == null ||
              !Number.isFinite(tl) ||
              !Number.isFinite(tr) ||
              !Number.isFinite(br) ||
              !Number.isFinite(bl)
            ) {
              continue
            }
            const pairs = cellSegments(tl, tr, br, bl, level)
            for (const [a, b] of pairs) {
              segments.push([edgeToLatLng(row, col, a), edgeToLatLng(row, col, b)])
            }
          }
        }

        ctx.beginPath()
        let bestLabel = null
        let bestDist = Infinity
        for (const [[lat1, lng1], [lat2, lng2]] of segments) {
          const [x1, y1] = project(lat1, lng1)
          const [x2, y2] = project(lat2, lng2)
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)

          if (level % LABEL_STEP === 0) {
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2
            const dx = mx - W / 2
            const dy = my - H / 2
            const d2 = dx * dx + dy * dy
            if (d2 < bestDist) {
              bestDist = d2
              bestLabel = [mx, my]
            }
          }
        }
        ctx.stroke()

        if (bestLabel) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
          ctx.font = '600 11px Inter, system-ui, sans-serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const [lx, ly] = bestLabel
          ctx.fillText(`${level}`, lx, ly)
        }
      }
    }

    draw()
    map.on('moveend', draw)
    map.on('zoomend', draw)
    map.on('resize', draw)

    return () => {
      try {
        canvas.remove()
      } catch (e) {}
      map.off('moveend', draw)
      map.off('zoomend', draw)
      map.off('resize', draw)
    }
  }, [ecmwfPressure, map])

  return null
}
