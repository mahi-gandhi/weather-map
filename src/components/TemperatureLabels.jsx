import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import { getFirstGrid } from '../lib/getFirstGrid.js'
import {
  boundsFromHeader,
  sampleTemperatureAtLatLng,
} from '../lib/sampleTemperatureMatrix.js'

const LABEL_SPACING = 200

export default function TemperatureLabels({ grids }) {
  const map = useMap()
  const [labels, setLabels] = useState([])

  const field = useMemo(() => {
    if (!grids) return null
    const grid = getFirstGrid(grids)
    if (!grid?.sampleMatrix) return null
    return {
      sampleMatrix: grid.sampleMatrix,
      sampleSize: grid.sampleSize ?? grid.sampleMatrix.length,
      bounds: boundsFromHeader(grid.header),
    }
  }, [grids])

  useEffect(() => {
    if (!field) {
      setLabels([])
      return
    }

    function updateLabels() {
      const size = map.getSize()
      const next = []

      for (let y = LABEL_SPACING / 2; y < size.y; y += LABEL_SPACING) {
        for (let x = LABEL_SPACING / 2; x < size.x; x += LABEL_SPACING) {
          const latlng = map.containerPointToLatLng([x, y])
          const temp = sampleTemperatureAtLatLng(
            field.sampleMatrix,
            field.sampleSize,
            latlng.lat,
            latlng.lng,
            field.bounds,
          )
          if (temp == null || Number.isNaN(temp)) continue
          next.push({
            key: `${x}-${y}`,
            x,
            y,
            text: `${Math.round(temp)}°`,
          })
        }
      }

      setLabels(next)
    }

    updateLabels()
    map.on('move', updateLabels)
    map.on('zoom', updateLabels)
    map.on('resize', updateLabels)

    return () => {
      map.off('move', updateLabels)
      map.off('zoom', updateLabels)
      map.off('resize', updateLabels)
    }
  }, [map, field])

  if (!labels.length) return null

  return createPortal(
    <div className="temperature-labels" aria-hidden>
      {labels.map(({ key, x, y, text }) => (
        <span
          key={key}
          className="temperature-labels__item"
          style={{ left: x, top: y }}
        >
          {text}
        </span>
      ))}
    </div>,
    map.getContainer(),
  )
}
