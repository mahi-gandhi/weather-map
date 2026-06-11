import { useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { createWaveParticleOverlay } from '../lib/createWaveParticleOverlay.js'

export default function WaveParticleOverlay({ waveData, active = true }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const systemRef = useRef(null)

  const gridData = useMemo(() => waveData?.data ?? null, [waveData])

  useEffect(() => {
    const pane = map.getPanes().overlayPane
    const canvas = document.createElement('canvas')
    canvas.className = 'wave-particle-canvas'
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '370'
    pane.appendChild(canvas)
    canvasRef.current = canvas

    return () => {
      systemRef.current?.destroy()
      systemRef.current = null
      canvas.remove()
      canvasRef.current = null
    }
  }, [map])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !gridData) return

    systemRef.current?.destroy()
    systemRef.current = null

    if (!active) {
      canvas.style.display = 'none'
      return
    }

    canvas.style.display = 'block'

    try {
      systemRef.current = createWaveParticleOverlay(canvas, map, gridData)
      systemRef.current.start()
    } catch (err) {
      console.error('[WaveParticleOverlay] failed to start', err)
    }

    return () => {
      systemRef.current?.destroy()
      systemRef.current = null
    }
  }, [map, gridData, active])

  useEffect(() => {
    if (!active) {
      systemRef.current?.stop()
    } else if (systemRef.current && gridData) {
      systemRef.current.start()
    }
  }, [active, gridData])

  return null
}
