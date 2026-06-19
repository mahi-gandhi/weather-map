import TemperatureCanvas from './TemperatureCanvas.jsx'
import TemperatureLabels from './TemperatureLabels.jsx'

export default function WeatherOverlay({ layerId, grids }) {
  if (!grids || layerId !== 'temperature') return null

  return (
    <>
      <TemperatureCanvas grids={grids} />
      <TemperatureLabels grids={grids} />
    </>
  )
}
