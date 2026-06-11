import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import { MapRefContext } from '../context/MapRefContext.jsx'

export default function MapRefBridge({ mapRef }) {
  const map = useMap()

  useEffect(() => {
    mapRef.current = map
    return () => {
      mapRef.current = null
    }
  }, [map, mapRef])

  return null
}
