import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { colorForSpeed } from '../lib/ecmwfColor.js'

export default function VectorCanvas({ ecmwfLayer, colorScheme, oceanMask }) {
  const map = useMap()
  const canvasRef = useRef(null)

  useEffect(() => {
    const uField = ecmwfLayer?.[0]?.data
    const vField = ecmwfLayer?.[1]?.data
    if (!map || !uField || !vField) return

    const parent = map.getContainer()
    parent.style.position = 'relative'

    const canvas = document.createElement('canvas')
    canvas.setAttribute('data-weather-canvas', 'true')
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '400'
    parent.appendChild(canvas)
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')

    function sampleUV(lat, lng) {
      const lon = ((lng % 360) + 360) % 360
      const col = Math.floor(lon) % 360
      const row = Math.floor(90 - lat)
      if (row < 0 || row > 180 || col < 0 || col >= 360) return null
      const idx = row * 360 + col
      const u = uField[idx]
      const v = vField[idx]
      if (u == null || v == null) return null
      return { u, v }
    }

    function draw() {
      const W = parent.offsetWidth
      const H = parent.offsetHeight
      canvas.width = W
      canvas.height = H

      const SCALE = 0.6
      const rw = Math.ceil(W * SCALE)
      const rh = Math.ceil(H * SCALE)

      const colorBuf = document.createElement('canvas')
      colorBuf.width = rw
      colorBuf.height = rh
      const cctx = colorBuf.getContext('2d')
      const img = cctx.createImageData(rw, rh)

      const maskBuf = document.createElement('canvas')
      maskBuf.width = rw
      maskBuf.height = rh
      const mctx = maskBuf.getContext('2d')
      const maskImg = mctx.createImageData(rw, rh)

      for (let px = 0; px < rw; px++) {
        for (let py = 0; py < rh; py++) {
          const realX = px / SCALE
          const realY = py / SCALE
          const ll = map.containerPointToLatLng([realX, realY])
          if (oceanMask) {
            const lon = ((ll.lng % 360) + 360) % 360
            const col = Math.floor(lon)
            const row = Math.floor(90 - ll.lat)
            if (row >= 0 && row <= 180 && col >= 0 && col < 360) {
              if (oceanMask[row * 360 + col] === 1) continue
            }
          }
          const uv = sampleUV(ll.lat, ll.lng)
          if (!uv) continue

          const speed = Math.sqrt(uv.u * uv.u + uv.v * uv.v)
          const [r, g, b] = colorForSpeed(speed, colorScheme)
          const alpha = Math.min(185, Math.round(95 + speed * 10))
          const i = (py * rw + px) * 4
          img.data[i] = r
          img.data[i + 1] = g
          img.data[i + 2] = b
          img.data[i + 3] = alpha

          maskImg.data[i] = 255
          maskImg.data[i + 1] = 255
          maskImg.data[i + 2] = 255
          maskImg.data[i + 3] = 255
        }
      }

      cctx.putImageData(img, 0, 0)
      mctx.putImageData(maskImg, 0, 0)

      const blurred = document.createElement('canvas')
      blurred.width = rw
      blurred.height = rh
      const bctx = blurred.getContext('2d')
      bctx.filter = 'blur(2.2px)'
      bctx.drawImage(colorBuf, 0, 0)

      const finalMask = document.createElement('canvas')
      finalMask.width = rw
      finalMask.height = rh
      const fmctx = finalMask.getContext('2d')
      fmctx.filter = 'blur(1.4px)'
      fmctx.drawImage(maskBuf, 0, 0)

      const composited = document.createElement('canvas')
      composited.width = rw
      composited.height = rh
      const compCtx = composited.getContext('2d')
      compCtx.drawImage(blurred, 0, 0)
      compCtx.globalCompositeOperation = 'destination-in'
      compCtx.drawImage(finalMask, 0, 0)

      ctx.clearRect(0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(composited, 0, 0, rw, rh, 0, 0, W, H)
    }

    function onMoveStart() {
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }

    draw()
    map.on('movestart', onMoveStart)
    map.on('zoomstart', onMoveStart)
    map.on('moveend', draw)
    map.on('zoomend', draw)
    map.on('resize', draw)

    return () => {
      try {
        canvas.remove()
      } catch (e) {}
      map.off('movestart', onMoveStart)
      map.off('zoomstart', onMoveStart)
      map.off('moveend', draw)
      map.off('zoomend', draw)
      map.off('resize', draw)
    }
  }, [colorScheme, ecmwfLayer, map, oceanMask])

  return null
}
