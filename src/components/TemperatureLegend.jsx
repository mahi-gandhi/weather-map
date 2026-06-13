import { buildTemperatureLegendGradient } from '../lib/temperatureLut.js'
import '../styles/maritime.css'

const LEGEND_LABELS = [
  { value: 45, label: '45°C+', title: 'deep red' },
  { value: 35, label: '35°C', title: 'hot pink-red' },
  { value: 28, label: '28°C', title: 'pink' },
  { value: 20, label: '20°C', title: 'lavender-pink' },
  { value: 10, label: '10°C', title: 'light blue' },
  { value: 0, label: '0°C', title: 'blue-purple' },
  { value: -15, label: '-15°C', title: 'purple' },
  { value: -30, label: '-30°C', title: 'deep purple' },
]

const gradient = buildTemperatureLegendGradient()

export default function TemperatureLegend({ visible }) {
  if (!visible) return null

  return (
    <div className="temp-legend" aria-label="Temperature legend">
      <div className="temp-legend__scale">
        <div className="temp-legend__labels">
          {LEGEND_LABELS.map(({ label, title }) => (
            <span key={label} title={title}>
              {label}
            </span>
          ))}
        </div>
        <div
          className="temp-legend__bar"
          style={{ background: gradient }}
        />
      </div>
    </div>
  )
}
