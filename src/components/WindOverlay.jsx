import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { createWindParticleOverlay } from '../lib/createWindParticleOverlay.js'
import { createWindCanvasHeatmap } from '../lib/createWindCanvasHeatmap.js'
import { getFirstGrid } from '../lib/getFirstGrid.js'
import { getSpeedData, getVectorData } from '../lib/fetchOpenMeteo.js'

export default function WindOverlay({
  grids,
  onParticlesReady,
  onCanvasHeatmap,
}) {
  const map = useMap()
  const canvasRef = useRef(null)
  const systemRef = useRef(null)
  const onParticlesReadyRef = useRef(onParticlesReady)
  const onCanvasHeatmapRef = useRef(onCanvasHeatmap)

  useEffect(() => {
    onParticlesReadyRef.current = onParticlesReady
    onCanvasHeatmapRef.current = onCanvasHeatmap
  }, [onParticlesReady, onCanvasHeatmap])

  useEffect(() => {
    const pane = map.getPanes().overlayPane
    const canvas = document.createElement('canvas')
    canvas.className = 'wind-particle-canvas'
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '460'
    pane.appendChild(canvas)
    canvasRef.current = canvas

    const syncCanvasToPane = () => {
      const size = map.getSize()
      const topLeft = map.containerPointToLayerPoint([0, 0])
      canvas.style.left = `${-topLeft.x}px`
      canvas.style.top = `${-topLeft.y}px`
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`
      systemRef.current?.resize?.() ?? systemRef.current?.redraw?.()
    }

    const redraw = () => {
      syncCanvasToPane()
      systemRef.current?.redraw?.() ?? systemRef.current?.resize?.()
    }

    syncCanvasToPane()
    map.on('move', redraw)
    map.on('resize', redraw)
    map.on('zoom', redraw)
    map.on('zoomend', redraw)

    return () => {
      map.off('move', redraw)
      map.off('resize', redraw)
      map.off('zoom', redraw)
      map.off('zoomend', redraw)
      systemRef.current?.destroy()
      systemRef.current = null
      onParticlesReadyRef.current?.(false)
      onCanvasHeatmapRef.current?.(false)
      canvas.remove()
      canvasRef.current = null
    }
  }, [map])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !grids) return

    onParticlesReadyRef.current?.(false)
    onCanvasHeatmapRef.current?.(false)

    if (systemRef.current) {
      systemRef.current.destroy()
      systemRef.current = null
    }

    const startCanvasHeatmap = () => {
      const vector = getVectorData(grids)
      const header = getFirstGrid(grids).header
      if (!vector) return

      onCanvasHeatmapRef.current?.(true)
      canvas.style.display = 'block'
      canvas.classList.add('smooth-weather-canvas')
      try {
        systemRef.current = createWindCanvasHeatmap(canvas, {
          header,
          u: vector.u,
          v: vector.v,
          speed: getSpeedData(grids) ?? undefined,
          map,
        })
        systemRef.current.start()
      } catch (err) {
        console.error('[WindOverlay] canvas heatmap failed', err)
        onCanvasHeatmapRef.current?.(false)
      }
    }

    canvas.classList.remove('smooth-weather-canvas')

    if (grids.gfsMeta) {
      try {
        systemRef.current = createWindParticleOverlay(
          canvas,
          map,
          grids.gfsMeta,
        )
        systemRef.current.start()
        onParticlesReadyRef.current?.(true)
        onCanvasHeatmapRef.current?.(false)
        console.info('[WindOverlay] Canvas 2D particles', grids.dataSource)
      } catch (err) {
        console.warn('[WindOverlay] particles failed — heatmap fallback', err)
        startCanvasHeatmap()
      }
    } else {
      startCanvasHeatmap()
    }

    return () => {
      systemRef.current?.destroy()
      systemRef.current = null
      onParticlesReadyRef.current?.(false)
      onCanvasHeatmapRef.current?.(false)
    }
  }, [map, grids])

  return null
}
