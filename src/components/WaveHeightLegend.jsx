import '../styles/maritime.css'
import { buildWaveLegendGradient } from '../lib/waveColorRamp.js'

const LEGEND_LABELS = [
  { value: 7, label: '7m+' },
  { value: 5, label: '5m' },
  { value: 3.5, label: '3.5m' },
  { value: 2, label: '2m' },
  { value: 1, label: '1m' },
  { value: 0.3, label: '0.3m' },
]

const gradient = buildWaveLegendGradient()

export default function WaveHeightLegend({ visible }) {
  if (!visible) return null

  return (
    <div className="wave-legend" aria-label="Wave height legend">
      <span className="wave-legend__title">Wave Height</span>
      <div className="wave-legend__scale">
        <div className="wave-legend__labels">
          {LEGEND_LABELS.map(({ label }) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div
          className="wave-legend__bar"
          style={{ background: gradient }}
        />
      </div>
    </div>
  )
}
