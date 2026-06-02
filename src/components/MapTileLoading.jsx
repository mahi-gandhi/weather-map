import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

export default function MapTileLoading({ onTilesLoadingChange }) {
  const map = useMap()

  useEffect(() => {
    const onLoading = () => onTilesLoadingChange(true)
    const onLoad = () => onTilesLoadingChange(false)

    map.on('loading', onLoading)
    map.on('load', onLoad)

    return () => {
      map.off('loading', onLoading)
      map.off('load', onLoad)
    }
  }, [map, onTilesLoadingChange])

  return null
}
