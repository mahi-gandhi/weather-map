import { useEffect } from 'react'
import { TileLayer, useMap } from 'react-leaflet'

const LABELS_Z_INDEX = 500

/**
 * Labels above weather canvases in overlayPane (z-index 500).
 */
export default function LabelsTileLayer({ url, ...options }) {
  const map = useMap()

  useEffect(() => {
    const pane = map.getPane('overlayPane')
    if (pane) {
      pane.style.zIndex = pane.style.zIndex || '400'
    }
  }, [map])

  return (
    <TileLayer
      url={url}
      pane="overlayPane"
      zIndex={LABELS_Z_INDEX}
      {...options}
    />
  )
}
