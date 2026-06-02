import { useMapEvents } from 'react-leaflet'

export default function MapInteraction({ onMapClick }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng)
    },
  })

  return null
}
