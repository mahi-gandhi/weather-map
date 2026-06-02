import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchPointForecast } from '../lib/fetchOpenMeteo.js'
import '../styles/maritime.css'

const CARD_W = 380

function windDirLabel(deg) {
  if (deg == null || Number.isNaN(deg)) return '—'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

export default function ForecastPanel({ position, onClose }) {
  const map = useMap()
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)
  const [anchor, setAnchor] = useState(null)

  useEffect(() => {
    if (!position) {
      setAnchor(null)
      return
    }

    const updatePosition = () => {
      const pt = map.latLngToContainerPoint(position)
      const size = map.getSize()
      let left = pt.x + 14
      let top = pt.y - 24
      if (left + CARD_W > size.x - 12) left = Math.max(12, pt.x - CARD_W - 14)
      if (top < 52) top = 52
      if (top > size.y - 420) top = Math.max(52, size.y - 430)
      setAnchor({ left, top })
    }

    updatePosition()
    map.on('move', updatePosition)
    map.on('zoom', updatePosition)
    map.on('resize', updatePosition)

    return () => {
      map.off('move', updatePosition)
      map.off('zoom', updatePosition)
      map.off('resize', updatePosition)
    }
  }, [position, map])

  useEffect(() => {
    if (!position) return
    let cancelled = false
    const lat = position.lat
    const lng = position.lng

    setForecast(null)
    setError(null)

    fetchPointForecast(lat, lng)
      .then((data) => {
        console.log('[ForecastPanel] API data', data)
        if (!cancelled) setForecast(data)
      })
      .catch((err) => {
        console.warn('[ForecastPanel] fetch failed', err)
        if (!cancelled) setError('Could not load forecast')
      })

    return () => {
      cancelled = true
    }
  }, [position?.lat, position?.lng])

  if (!position || !anchor) return null

  const chartTooltipStyle = {
    background: 'rgba(10, 15, 30, 0.95)',
    border: 'none',
    borderRadius: 8,
    fontSize: 11,
    color: '#e2e8f0',
  }

  const card = (
    <div
      className="forecast-card"
      style={{ left: anchor.left, top: anchor.top, width: CARD_W }}
      role="dialog"
      aria-label="Point forecast"
    >
      <div className="forecast-card__header">
        <div>
          <p className="forecast-card__coords">
            {position.lat.toFixed(2)}°, {position.lng.toFixed(2)}°
          </p>
        </div>
        <button type="button" className="forecast-card__close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="forecast-card__tabs">
        <button type="button" className="forecast-card__tab forecast-card__tab--active">
          Open-Meteo
        </button>
      </div>

      {error && <p className="forecast-card__message forecast-card__message--error">{error}</p>}
      {!forecast && !error && (
        <p className="forecast-card__message">Loading forecast…</p>
      )}

      {forecast && (
        <>
          <div className="forecast-card__stats">
            <div className="forecast-stat">
              <span className="forecast-stat__label">Temperature</span>
              <span className="forecast-stat__value">
                {forecast.temperature != null
                  ? `${forecast.temperature.toFixed(1)}°C`
                  : '—'}
              </span>
            </div>
            <div className="forecast-stat">
              <span className="forecast-stat__label">Wind</span>
              <span className="forecast-stat__value">
                {forecast.wind != null ? `${forecast.wind.toFixed(0)} km/h` : '—'}
                {forecast.windDirection != null && (
                  <small> {windDirLabel(forecast.windDirection)}</small>
                )}
              </span>
            </div>
            <div className="forecast-stat">
              <span className="forecast-stat__label">Rain</span>
              <span className="forecast-stat__value">
                {forecast.precipitation != null
                  ? `${forecast.precipitation.toFixed(1)} mm/h`
                  : '—'}
              </span>
            </div>
            {forecast.waveHeight != null && (
              <div className="forecast-stat">
                <span className="forecast-stat__label">Waves</span>
                <span className="forecast-stat__value">
                  {forecast.waveHeight.toFixed(1)} m
                </span>
              </div>
            )}
          </div>

          <div className="forecast-card__section">
            <h4 className="forecast-card__section-title">Temperature · 48h</h4>
            <div className="forecast-card__chart">
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={forecast.hourly}>
                  <defs>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00d4ff" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    interval={7}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    width={32}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="temperature"
                    stroke="#00d4ff"
                    strokeWidth={2}
                    fill="url(#tempGrad)"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="forecast-card__section">
            <h4 className="forecast-card__section-title">Precipitation · 48h</h4>
            <div className="forecast-card__chart">
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={forecast.hourly}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    interval={7}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 9 }}
                    width={28}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar
                    dataKey="precipitation"
                    fill="#38bdf8"
                    fillOpacity={0.85}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )

  return createPortal(card, map.getContainer())
}
