import { useEffect, useMemo, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { getFirstGrid } from '../lib/getFirstGrid.js'
import { createTemperatureOverlay } from '../lib/createTemperatureOverlay.js'
import { buildTemperatureLut1024 } from '../lib/temperatureLut.js'
import { TEMPERATURE_SAMPLE_SIZE } from '../lib/sampleGrid.js'
import {
  logTemperatureBoundsDebug,
  countValidTemperatureSamples,
  syncWeatherCanvasToMapContainer,
} from '../lib/temperatureCanvasSync.js'
import { getLayerFetchBounds } from '../lib/boundsPad.js'

export default function TemperatureCanvas({ grids }) {
  const map = useMap()
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)

  const lutSpec = useMemo(() => buildTemperatureLut1024(), [])

  const field = useMemo(() => {
    if (!grids) return null
    const grid = getFirstGrid(grids)
    if (!grid?.header) return null

    const sampleMatrix = grid.sampleMatrix
    const sampleSize = grid.sampleSize ?? TEMPERATURE_SAMPLE_SIZE

    if (!sampleMatrix || !sampleSize) return null

    return {
      header: grid.header,
      sampleMatrix,
      sampleSize,
    }
  }, [grids])

  useEffect(() => {
    const container = map.getContainer()
    const canvas = document.createElement('canvas')
    canvas.className = 'temperature-canvas smooth-weather-canvas'
    canvas.style.zIndex = '650'
    canvas.style.opacity = '1'
    canvas.style.transition = 'opacity 0.3s ease'
    canvas.style.imageRendering = 'auto'
    container.appendChild(canvas)
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
    if (!field || !canvas) return

    const visible = map.getBounds()
    const fetchBounds = getLayerFetchBounds('temperature', visible)
    const { width, height } = syncWeatherCanvasToMapContainer(canvas, map)

    logTemperatureBoundsDebug(visible, fetchBounds, {
      canvasWidth: width,
      canvasHeight: height,
      gridWidth: field.sampleSize,
      gridHeight: field.sampleSize,
      sampleCount: countValidTemperatureSamples(field.sampleMatrix),
      header: field.header,
    })
  }, [map, field])

  useEffect(() => {
    const canvas = canvasRef.current
    overlayRef.current?.destroy()
    overlayRef.current = null

    if (!canvas || !field) return

    const options = { ...field, lutSpec }
    canvas.style.opacity = '0.75'
    overlayRef.current = createTemperatureOverlay(canvas, map, options)
    overlayRef.current.start()

    return () => {
      overlayRef.current?.destroy()
      overlayRef.current = null
    }
  }, [map, field, lutSpec])

  return null
}
