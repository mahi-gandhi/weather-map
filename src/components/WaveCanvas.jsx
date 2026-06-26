import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { sampleWave as sampleWaveStatic, waveColor } from '../lib/wave-utils.js'

export default function WaveCanvas({ waveData, ecmwfWave }) {
  const map = useMap()
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!map || (!ecmwfWave && !waveData?.data)) return
    const data = waveData?.data
    const landMask = waveData?.landMask

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

    function draw() {
      const W = parent.offsetWidth
      const H = parent.offsetHeight
      canvas.width = W
      canvas.height = H

      const rw = W
      const rh = H

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

      const bounds = map.getBounds()
      const west = bounds.getWest()
      const east = bounds.getEast()

      function sampleWave(lat, lng) {
        if (ecmwfWave) {
          const lon = ((lng % 360) + 360) % 360
          const col = Math.floor(lon) % 360
          const row = Math.floor(90 - lat)
          if (row < 0 || row > 180 || col < 0 || col >= 360) return -1
          const idx = row * 360 + col
          const U = ecmwfWave[0]?.data?.[idx]
          const V = ecmwfWave[1]?.data?.[idx]
          if (U == null || V == null) return -1
          const speed = Math.sqrt(U * U + V * V)
          return speed < 0.05 ? -1 : speed
        }
        return sampleWaveStatic(data, landMask, lat, lng)
      }

      for (let px = 0; px < rw; px++) {
        for (let py = 0; py < rh; py++) {
          const ll = map.containerPointToLatLng([px, py])

          let lng = ll.lng
          while (lng < west) lng += 360
          while (lng > west + 360) lng -= 360
          if (lng > east + 1) continue

          const v = sampleWave(ll.lat, lng)
          const i = (py * rw + px) * 4
          if (v < 0) continue

          const displayV = Math.max(v, 0.15)
          const [r, g, b] = waveColor(displayV)
          const alpha = Math.min(180, Math.round(100 + displayV * 12))

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
      bctx.filter = 'blur(5px)'
      bctx.drawImage(colorBuf, 0, 0)

      const finalMask = document.createElement('canvas')
      finalMask.width = rw
      finalMask.height = rh
      const fmctx = finalMask.getContext('2d')
      fmctx.filter = 'blur(1.5px)'
      fmctx.drawImage(maskBuf, 0, 0)

      const composited = document.createElement('canvas')
      composited.width = rw
      composited.height = rh
      const compCtx = composited.getContext('2d')
      compCtx.drawImage(blurred, 0, 0)
      compCtx.globalCompositeOperation = 'destination-in'
      compCtx.drawImage(finalMask, 0, 0)

      ctx.clearRect(0, 0, W, H)
      ctx.drawImage(composited, 0, 0)
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
  }, [ecmwfWave, map, waveData])

  return null
}
