import { WINDY_SPEED_STOPS } from '../lib/windColorRamp.js'
import '../styles/maritime.css'

const TICKS = [0, 20, 40, 60, 80, 100]

export default function WindLegend({ visible }) {
  if (!visible) return null

  const stops = [...WINDY_SPEED_STOPS].reverse()

  return (
    <div className="wind-legend" aria-label="Wind speed legend">
      <span className="wind-legend__title">km/h</span>
      <div className="wind-legend__scale">
        <div className="wind-legend__labels">
          {TICKS.map((v) => (
            <span key={v}>{v}</span>
          ))}
          <span>100+</span>
        </div>
        <div className="wind-legend__bar">
          {stops.slice(0, -1).map((stop) => {
            const [r, g, b] = stop.rgb
            return (
              <div
                key={stop.value}
                className="wind-legend__segment"
                style={{
                  flex: 1,
                  background: `rgb(${r},${g},${b})`,
                }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
