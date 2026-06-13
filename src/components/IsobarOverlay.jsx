import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { IsobarCanvas } from '../lib/isobarCanvas.js'

/**
 * Renders isobar contours when pressure grid data is available.
 * @param {{ pressureData: { header: object, data: number[] } | null }} props
 */
export default function IsobarOverlay({ pressureData }) {
  const map = useMap()
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!pressureData?.header || !pressureData?.data) {
      if (canvasRef.current) {
        canvasRef.current.destroy()
        canvasRef.current = null
      }
      return undefined
    }

    const instance = new IsobarCanvas(map, pressureData)
    canvasRef.current = instance

    return () => {
      instance.destroy()
      canvasRef.current = null
    }
  }, [map, pressureData])

  return null
}
