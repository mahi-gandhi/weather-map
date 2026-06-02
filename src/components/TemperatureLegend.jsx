import { sampleTemperatureRgb } from '../lib/temperatureLut.js'
import '../styles/maritime.css'

const LEGEND_STOPS = [
  { value: 45, label: '45°C+' },
  { value: 35, label: '35°C' },
  { value: 20, label: '20°C' },
  { value: 0, label: '0°C' },
  { value: -20, label: '-20°C' },
]

export default function TemperatureLegend({ visible }) {
  if (!visible) return null

  const segments = LEGEND_STOPS.slice(0, -1).map((stop, i) => {
    const next = LEGEND_STOPS[i + 1]
    const mid = (stop.value + next.value) / 2
    const [r, g, b] = sampleTemperatureRgb(mid)
    return { key: stop.value, rgb: [r, g, b] }
  })

  return (
    <div className="temp-legend" aria-label="Temperature legend">
      <div className="temp-legend__scale">
        <div className="temp-legend__labels">
          {LEGEND_STOPS.map(({ value, label }) => (
            <span key={value}>{label}</span>
          ))}
        </div>
        <div className="temp-legend__bar">
          {segments.map(({ key, rgb }) => (
            <div
              key={key}
              className="temp-legend__segment"
              style={{
                flex: 1,
                background: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
