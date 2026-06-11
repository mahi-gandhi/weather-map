import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMap } from 'react-leaflet'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchPointForecast } from '../lib/fetchOpenMeteo.js'
import { sampleGlobalWaveAt } from '../lib/waveStaticGrid.js'
import '../styles/maritime.css'

const CARD_W = 380

function WindArrow({ degrees }) {
  const rot = degrees != null && !Number.isNaN(degrees) ? degrees : 0
  return (
    <span
      className="forecast-wind-arrow"
      style={{ transform: `rotate(${rot}deg)` }}
      aria-hidden
    >
      ↑
    </span>
  )
}

export default function ForecastPanel({
  position,
  onClose,
  activeLayer,
  waveGridData,
}) {
  const map = useMap()
  const [forecast, setForecast] = useState(null)
  const [error, setError] = useState(null)
  const [anchor, setAnchor] = useState(null)
  const [tab, setTab] = useState('today')

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
    setForecast(null)
    setError(null)
    setTab('today')

    fetchPointForecast(position.lat, position.lng)
      .then((data) => {
        if (!cancelled) setForecast(data)
      })
      .catch(() => {
        if (!cancelled) setError('Could not load forecast')
      })

    return () => {
      cancelled = true
    }
  }, [position?.lat, position?.lng])

  const clickWaveHeight = useMemo(() => {
    if (waveGridData) {
      return sampleGlobalWaveAt(position?.lat, position?.lng, waveGridData)
    }
    return null
  }, [position?.lat, position?.lng, waveGridData])

  const waveHeight =
    clickWaveHeight ?? forecast?.waveHeight ?? null
  const showWave =
    (forecast?.isOcean || clickWaveHeight != null) && waveHeight != null

  const chartData = useMemo(() => {
    if (!forecast) return []
    if (tab === 'today') return forecast.hourly?.slice(0, 24) ?? []
    if (tab === 'tomorrow') return forecast.hourly?.slice(24, 48) ?? []
    return forecast.daily ?? []
  }, [forecast, tab])

  const chartTooltipStyle = {
    background: 'rgba(10, 15, 30, 0.95)',
    border: 'none',
    borderRadius: 8,
    fontSize: 11,
    color: '#e2e8f0',
  }

  if (!position || !anchor) return null

  const card = (
    <div
      className="forecast-card"
      style={{ left: anchor.left, top: anchor.top, width: CARD_W }}
      role="dialog"
      aria-label="Point forecast"
    >
      <div className="forecast-card__header">
        <p className="forecast-card__coords">
          {position.lat.toFixed(2)}°, {position.lng.toFixed(2)}°
        </p>
        <button type="button" className="forecast-card__close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="forecast-card__tabs">
        {[
          { id: 'today', label: 'Today' },
          { id: 'tomorrow', label: 'Tomorrow' },
          { id: 'week', label: '7 Day' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`forecast-card__tab${tab === id ? ' forecast-card__tab--active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="forecast-card__message forecast-card__message--error">
          {error}
        </p>
      )}
      {!forecast && !error && (
        <p className="forecast-card__message">Loading forecast…</p>
      )}

      {forecast && (
        <>
          <div className="forecast-card__stats forecast-card__stats--current">
            <div className="forecast-stat">
              <span className="forecast-stat__label">Temperature</span>
              <span className="forecast-stat__value">
                {forecast.temperature != null
                  ? `${Math.round(forecast.temperature)}°C`
                  : '—'}
              </span>
            </div>
            <div className="forecast-stat forecast-stat--wind">
              <span className="forecast-stat__label">Wind</span>
              <span className="forecast-stat__value">
                <WindArrow degrees={forecast.windDirection} />
                {forecast.wind != null
                  ? `${Math.round(forecast.wind)} km/h`
                  : '—'}
              </span>
            </div>
            <div className="forecast-stat">
              <span className="forecast-stat__label">Precipitation</span>
              <span className="forecast-stat__value">
                {forecast.precipitation != null
                  ? `${forecast.precipitation.toFixed(1)} mm/h`
                  : '—'}
              </span>
            </div>
            {showWave && (
              <div className="forecast-stat">
                <span className="forecast-stat__label">Wave height</span>
                <span className="forecast-stat__value">
                  {waveHeight.toFixed(1)} m
                </span>
              </div>
            )}
          </div>

          {tab !== 'week' && (
            <>
              <div className="forecast-card__section">
                <h4 className="forecast-card__section-title">
                  Temperature · 48h
                </h4>
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
                <h4 className="forecast-card__section-title">
                  Precipitation · 48h
                </h4>
                <div className="forecast-card__chart forecast-card__chart--short">
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

          {tab === 'week' && (
            <div className="forecast-card__section">
              <h4 className="forecast-card__section-title">7-day overview</h4>
              <div className="forecast-card__chart">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 9 }}
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
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      stroke="#00d4ff"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="forecast-card__chart forecast-card__chart--short">
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#64748b', fontSize: 9 }}
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
          )}

          {tab !== 'week' && chartData.length > 0 && (
            <p className="forecast-card__tab-hint">
              {tab === 'today' ? 'Today' : 'Tomorrow'}: {chartData.length} hours
              in range
            </p>
          )}
        </>
      )}
    </div>
  )

  return createPortal(card, map.getContainer())
}
