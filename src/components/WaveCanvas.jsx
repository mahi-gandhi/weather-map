import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

function sampleWave(lat, lng, data) {
  if (lat > 90 || lat < -90) return 0

  const lon = ((lng % 360) + 360) % 360

  const col0 = Math.floor(lon) % 360
  const col1 = (col0 + 1) % 360
  const row0 = Math.floor(90 - lat)
  const row1 = Math.min(row0 + 1, 180)

  const fx = lon - Math.floor(lon)
  const fy = (90 - lat) - Math.floor(90 - lat)

  const v00 = data[row0 * 360 + col0]
  const v10 = data[row0 * 360 + col1]
  const v01 = data[row1 * 360 + col0]
  const v11 = data[row1 * 360 + col1]

  if (!v00 && !v10 && !v01 && !v11) return 0

  return (v00 * (1 - fx) * (1 - fy)) +
         (v10 * fx * (1 - fy)) +
         (v01 * (1 - fx) * fy) +
         (v11 * fx * fy)
}

function waveColor(v) {
  const stops = [
    [0,    [20,  10,  60]],
    [0.3,  [30,  30, 120]],
    [1.0,  [20,  80, 180]],
    [2.0,  [0,  160, 180]],
    [3.5,  [0,  200, 140]],
    [5.0,  [80, 180,  80]],
    [7.0,  [140, 80, 180]],
    [10.0, [200, 60, 220]],
  ]

  if (v <= stops[0][0]) return stops[0][1]
  if (v >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]

  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const t = (v - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])
      const a = stops[i - 1][1]
      const b = stops[i][1]
      return [
        Math.round(a[0] + (b[0] - a[0]) * t),
        Math.round(a[1] + (b[1] - a[1]) * t),
        Math.round(a[2] + (b[2] - a[2]) * t),
      ]
    }
  }

  return stops[stops.length - 1][1]
}

export default function WaveCanvas({ waveData }) {
  const map = useMap()
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!waveData?.data) return
    const data = waveData.data

    const container = map.getContainer()
    const canvas = document.createElement('canvas')
    canvas.className = 'wave-height-canvas'
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '400'
    canvas.style.background = 'transparent'
    container.appendChild(canvas)
    canvasRef.current = canvas

    function draw() {
      const W = container.offsetWidth
      const H = container.offsetHeight

      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W, H)

      const SCALE = 0.5
      const renderW = Math.floor(W * SCALE)
      const renderH = Math.floor(H * SCALE)

      const bounds = map.getBounds()
      const westBound = bounds.getWest()
      const eastBound = bounds.getEast()

      // Step 1: color buffer (wave heatmap + blur) at reduced resolution
      const colorBuf = document.createElement('canvas')
      colorBuf.width = renderW
      colorBuf.height = renderH
      const colorCtx = colorBuf.getContext('2d')
      const colorImg = colorCtx.createImageData(renderW, renderH)

      for (let px = 0; px < renderW; px++) {
        for (let py = 0; py < renderH; py++) {
          const ll = map.containerPointToLatLng(L.point(px / SCALE, py / SCALE))
          const rawLng = ll.lng

          let normalizedLng = rawLng
          while (normalizedLng < westBound) normalizedLng += 360
          while (normalizedLng > westBound + 360) normalizedLng -= 360

          if (normalizedLng > eastBound) continue

          const v = sampleWave(ll.lat, normalizedLng, data)
          if (v <= 0) continue
          const displayV = Math.max(v, 0.15)
          const [r, g, b] = waveColor(displayV)
          const alpha = Math.min(240, Math.round(120 + v * 30))
          const i = (py * renderW + px) * 4
          colorImg.data[i] = r
          colorImg.data[i + 1] = g
          colorImg.data[i + 2] = b
          colorImg.data[i + 3] = alpha
        }
      }
      colorCtx.putImageData(colorImg, 0, 0)

      const blurred = document.createElement('canvas')
      blurred.width = renderW
      blurred.height = renderH
      const blurCtx = blurred.getContext('2d')
      blurCtx.filter = 'blur(6px)'
      blurCtx.drawImage(colorBuf, 0, 0)

      // Step 2: ocean mask (hard clip at coastlines) at reduced resolution
      const maskBuf = document.createElement('canvas')
      maskBuf.width = renderW
      maskBuf.height = renderH
      const maskCtx = maskBuf.getContext('2d')
      const maskImg = maskCtx.createImageData(renderW, renderH)

      for (let px = 0; px < renderW; px++) {
        for (let py = 0; py < renderH; py++) {
          const ll = map.containerPointToLatLng(L.point(px / SCALE, py / SCALE))
          const rawLng = ll.lng

          let normalizedLng = rawLng
          while (normalizedLng < westBound) normalizedLng += 360
          while (normalizedLng > westBound + 360) normalizedLng -= 360

          if (normalizedLng > eastBound) continue

          const lat = ll.lat
          const lon = ((normalizedLng % 360) + 360) % 360
          const col = Math.floor(lon)
          const row = Math.floor(90 - lat)
          if (row < 0 || row > 180 || col < 0 || col >= 360) continue
          if (data[row * 360 + col] <= 0.05) continue
          const i = (py * renderW + px) * 4
          maskImg.data[i] = 255
          maskImg.data[i + 1] = 255
          maskImg.data[i + 2] = 255
          maskImg.data[i + 3] = 255
        }
      }
      maskCtx.putImageData(maskImg, 0, 0)

      const finalMask = document.createElement('canvas')
      finalMask.width = renderW
      finalMask.height = renderH
      const finalMaskCtx = finalMask.getContext('2d')
      finalMaskCtx.filter = 'blur(2px)'
      finalMaskCtx.drawImage(maskBuf, 0, 0)

      // Step 3: upscale and clip color to ocean via destination-in
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(blurred, 0, 0, renderW, renderH, 0, 0, W, H)
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(finalMask, 0, 0, renderW, renderH, 0, 0, W, H)
      ctx.globalCompositeOperation = 'source-over'
    }

    function onMoveZoom() {
      canvas.style.opacity = '0.5'
    }

    function onMoveZoomEnd() {
      canvas.style.opacity = '1'
      draw()
    }

    draw()
    map.whenReady(draw)
    map.on('move zoom', onMoveZoom)
    map.on('moveend zoomend', onMoveZoomEnd)
    map.on('resize', draw)
    return () => {
      map.off('move zoom', onMoveZoom)
      map.off('moveend zoomend', onMoveZoomEnd)
      map.off('resize', draw)
      canvas.remove()
    }
  }, [map, waveData])

  return null
}
