import { useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { LAYERS } from '../lib/layers.js'
import { parseGridForDisplay } from '../lib/parseGridSpeed.js'
import {
  buildNormalizedRampLut,
  buildPhysicalColorLut,
} from '../lib/colorLut.js'
import { lookupGridBilinear } from '../lib/lookupGrid.js'
import { createSmoothCanvasOverlay } from '../lib/smoothCanvasOverlay.js'
import { WINDY_PHYSICAL_STOPS } from '../lib/windColorRamp.js'

export default function SmoothWeatherCanvas({ layerId, grids }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const layer = LAYERS[layerId]

  const display = useMemo(() => {
    if (!grids || !layer) return null
    try {
      return parseGridForDisplay(grids, layerId)
    } catch {
      return null
    }
  }, [grids, layer, layerId])

  const lutSpec = useMemo(() => {
    if (!display || !layer) return null

    if (display.physical) {
      const stops =
        layerId === 'wind' ? WINDY_PHYSICAL_STOPS : layer.physicalStops
      return {
        ...buildPhysicalColorLut(stops, layer.minVisible ?? 0),
        minVisible: layer.minVisible ?? 0,
      }
    }

    if (layer.ramp) {
      return {
        ...buildNormalizedRampLut(layer.ramp),
        minVisible: layer.zeroThreshold ?? 0,
      }
    }

    return null
  }, [display, layer, layerId])

  useEffect(() => {
    const pane = map.getPanes().overlayPane
    const canvas = document.createElement('canvas')
    canvas.className = 'smooth-weather-canvas'
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '450'
    pane.appendChild(canvas)
    canvasRef.current = canvas

    return () => {
      overlayRef.current?.destroy()
      overlayRef.current = null
      canvas.remove()
      canvasRef.current = null
    }
  }, [map])

  useEffect(() => {
    const canvas = canvasRef.current
    overlayRef.current?.destroy()
    overlayRef.current = null

    if (!canvas || !display || !lutSpec) return

    const { header, values } = display
    const data = values

    overlayRef.current = createSmoothCanvasOverlay(canvas, map, {
      getValueAtLatLng: (lat, lng) =>
        lookupGridBilinear(header, data, lat, lng),
      lut: lutSpec.lut,
      lutMin: lutSpec.min,
      lutMax: lutSpec.max,
      minVisible: lutSpec.minVisible,
      opacity: 0.75,
    })
    overlayRef.current.start()

    canvas.style.opacity = '0'
    requestAnimationFrame(() => {
      canvas.style.opacity = '0.75'
    })

    return () => {
      overlayRef.current?.destroy()
      overlayRef.current = null
    }
  }, [map, display, lutSpec])

  return null
}
