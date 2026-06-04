import SmoothWeatherCanvas from './SmoothWeatherCanvas.jsx'
import TemperatureCanvas from './TemperatureCanvas.jsx'
import PrecipitationCanvas from './PrecipitationCanvas.jsx'
import WaveHeightCanvas from './WaveHeightCanvas.jsx'

export default function WeatherOverlay({ layerId, grids }) {
  if (!grids) return null

  if (layerId === 'temperature') {
    return <TemperatureCanvas grids={grids} />
  }

  if (layerId === 'precipitation') {
    return <PrecipitationCanvas grids={grids} />
  }

  // Global 360×181 grid — WaveHeightCanvas uses direct lat/lon indexing, not bounds lookup
  if (layerId === 'wave_height') {
    return <WaveHeightCanvas grids={grids} />
  }

  return <SmoothWeatherCanvas layerId={layerId} grids={grids} />
}
