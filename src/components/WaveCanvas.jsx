import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'

const LUT = []
function buildLUT() {
  const stops = [
    [0.3,  [30,  60,  255]],
    [1.0,  [0,   140, 255]],
    [2.0,  [0,   220, 240]],
    [3.0,  [0,   255, 150]],
    [4.0,  [180, 255, 0  ]],
    [5.0,  [255, 200, 0  ]],
    [6.0,  [255, 100, 0  ]],
    [7.0,  [255, 20,  0  ]],
  ]
  for (let i = 0; i < 1024; i++) {
    const v = (i / 1023) * 7.0
    let r=255,g=255,b=255
    for (let s = 0; s < stops.length-1; s++) {
      if (v >= stops[s][0] && v <= stops[s+1][0]) {
        const t = (v - stops[s][0]) / (stops[s+1][0] - stops[s][0])
        r = stops[s][1][0] + t*(stops[s+1][1][0]-stops[s][1][0])
        g = stops[s][1][1] + t*(stops[s+1][1][1]-stops[s][1][1])
        b = stops[s][1][2] + t*(stops[s+1][1][2]-stops[s][1][2])
        break
      }
    }
    LUT.push([Math.round(r), Math.round(g), Math.round(b)])
  }
}
buildLUT()

function sampleWave(lat, lng, data) {
  if (lat > 90 || lat < -90) return 0
  const lonN = ((lng % 360) + 360) % 360
  const c0 = Math.floor(lonN)
  const c1 = (c0 + 1) % 360
  const tx = lonN - c0
  const latF = 90 - lat
  const r0 = Math.max(0, Math.min(180, Math.floor(latF)))
  const r1 = Math.min(180, r0 + 1)
  const ty = latF - r0
  const v00 = data[r0*360+c0]||0
  const v10 = data[r0*360+c1]||0
  const v01 = data[r1*360+c0]||0
  const v11 = data[r1*360+c1]||0
  if (v00===0 && v10===0 && v01===0 && v11===0) return 0
  let val=0, w=0
  if(v00>0){val+=v00*(1-tx)*(1-ty);w+=(1-tx)*(1-ty)}
  if(v10>0){val+=v10*tx*(1-ty);w+=tx*(1-ty)}
  if(v01>0){val+=v01*(1-tx)*ty;w+=(1-tx)*ty}
  if(v11>0){val+=v11*tx*ty;w+=tx*ty}
  return w > 0.1 ? val/w : 0
}

export default function WaveCanvas({ waveData }) {
  const map = useMap()
  const canvasRef = useRef(null)

  useEffect(() => {
    console.log('[WaveCanvas] waveData:', waveData)
    console.log('[WaveCanvas] data length:', waveData?.data?.length)

    if (!waveData?.data) return
    const data = waveData.data

    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:300;'
    map.getPanes().overlayPane.appendChild(canvas)
    canvasRef.current = canvas
    console.log('[WaveCanvas] canvas added to pane:', map.getPanes().overlayPane.children.length)

    function draw() {
      const W = map.getContainer().offsetWidth
      const H = map.getContainer().offsetHeight

      const topLeft = map.containerPointToLayerPoint(L.point(0, 0))
      canvas.style.left = `${-topLeft.x}px`
      canvas.style.top = `${-topLeft.y}px`
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`

      canvas.width = W
      canvas.height = H

      const S = 0.5
      const bw = Math.ceil(W * S)
      const bh = Math.ceil(H * S)

      const buf = document.createElement('canvas')
      buf.width = bw
      buf.height = bh
      const bctx = buf.getContext('2d')
      const img = bctx.createImageData(bw, bh)
      const px = img.data

      for (let py = 0; py < bh; py++) {
        for (let qx = 0; qx < bw; qx++) {
          const ll = map.containerPointToLatLng(
            L.point(qx / S, py / S)
          )
          const v = sampleWave(ll.lat, ll.lng, data)
          if (v < 0.05) continue
          const li = Math.min(1023, Math.floor((v / 7) * 1023))
          const [r, g, b] = LUT[li]
          const i = (py * bw + qx) * 4
          px[i] = r; px[i+1] = g; px[i+2] = b; px[i+3] = 195
        }
      }

      bctx.putImageData(img, 0, 0)

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W, H)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(buf, 0, 0, W, H)
    }

    draw()
    map.on('moveend zoomend resize', draw)
    return () => {
      map.off('moveend zoomend resize', draw)
      canvas.remove()
    }
  }, [map, waveData])

  return null
}
