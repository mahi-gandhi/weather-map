import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import { sampleGlobalWaveBilinear } from '../lib/waveStaticGrid.js'

const LABEL_SPACING = 500

export default function WaveHeightLabels({ grids }) {
  const map = useMap()
  const [labels, setLabels] = useState([])

  const gridData = useMemo(() => grids?.[0]?.data ?? null, [grids])

  useEffect(() => {
    if (!gridData) {
      setLabels([])
      return
    }

    function updateLabels() {
      const size = map.getSize()
      const next = []

      for (let y = LABEL_SPACING / 2; y < size.y; y += LABEL_SPACING) {
        for (let x = LABEL_SPACING / 2; x < size.x; x += LABEL_SPACING) {
          const latlng = map.containerPointToLatLng([x, y])
          const value = sampleGlobalWaveBilinear(
            latlng.lat,
            latlng.lng,
            gridData,
          )
          if (value == null) continue
          next.push({
            key: `${x}-${y}`,
            x,
            y,
            text: `${value.toFixed(1)}m`,
          })
        }
      }

      setLabels(next)
    }

    updateLabels()
    map.on('moveend', updateLabels)
    map.on('zoomend', updateLabels)
    map.on('resize', updateLabels)

    return () => {
      map.off('moveend', updateLabels)
      map.off('zoomend', updateLabels)
      map.off('resize', updateLabels)
    }
  }, [map, gridData])

  if (!labels.length) return null

  return createPortal(
    <div className="wave-height-labels" aria-hidden>
      {labels.map(({ key, x, y, text }) => (
        <span
          key={key}
          className="wave-height-labels__item"
          style={{ left: x, top: y }}
        >
          {text}
        </span>
      ))}
    </div>,
    map.getContainer(),
  )
}
