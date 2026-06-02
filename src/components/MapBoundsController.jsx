import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'

export default function MapBoundsController({ onBoundsChange, onZoomBucketChange }) {
  const map = useMap()
  const lastZoomRef = useRef(map.getZoom())

  useEffect(() => {
    const emitBounds = () => {
      onBoundsChange(map.getBounds())
    }

    const handleZoomEnd = () => {
      const zoom = map.getZoom()
      emitBounds()
      if (Math.abs(zoom - lastZoomRef.current) > 2) {
        lastZoomRef.current = zoom
        onZoomBucketChange?.(zoom)
      }
    }

    emitBounds()
    map.on('moveend', emitBounds)
    map.on('zoomend', handleZoomEnd)

    return () => {
      map.off('moveend', emitBounds)
      map.off('zoomend', handleZoomEnd)
    }
  }, [map, onBoundsChange, onZoomBucketChange])

  return null
}
