import SmoothWeatherCanvas from './SmoothWeatherCanvas.jsx'
import TemperatureCanvas from './TemperatureCanvas.jsx'
import PrecipitationCanvas from './PrecipitationCanvas.jsx'

export default function WeatherOverlay({ layerId, grids }) {
  if (!grids) return null

  if (layerId === 'temperature') {
    return <TemperatureCanvas grids={grids} />
  }

  if (layerId === 'precipitation') {
    return <PrecipitationCanvas grids={grids} />
  }

  return <SmoothWeatherCanvas layerId={layerId} grids={grids} />
}
