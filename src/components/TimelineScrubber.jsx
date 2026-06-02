import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  buildTimelineSteps,
  formatDayLabel,
  formatHourLabel,
  isSynopticHour,
} from '../lib/timeline.js'
import '../styles/maritime.css'

export default function TimelineScrubber({
  timeIndex,
  onTimeIndexChange,
  currentTimeIndex,
}) {
  const steps = useMemo(() => buildTimelineSteps(), [])
  const trackRef = useRef(null)
  const draggingRef = useRef(false)
  const [playing, setPlaying] = useState(false)

  const indexFromClientX = useCallback(
    (clientX) => {
      const track = trackRef.current
      if (!track) return timeIndex
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return Math.round(ratio * (steps.length - 1))
    },
    [steps.length, timeIndex],
  )

  const handlePointerDown = useCallback(
    (e) => {
      draggingRef.current = true
      setPlaying(false)
      trackRef.current?.setPointerCapture(e.pointerId)
      onTimeIndexChange(indexFromClientX(e.clientX))
    },
    [indexFromClientX, onTimeIndexChange],
  )

  const handlePointerMove = useCallback(
    (e) => {
      if (!draggingRef.current) return
      onTimeIndexChange(indexFromClientX(e.clientX))
    },
    [indexFromClientX, onTimeIndexChange],
  )

  const handlePointerUp = useCallback((e) => {
    draggingRef.current = false
    trackRef.current?.releasePointerCapture(e.pointerId)
  }, [])

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      onTimeIndexChange((prev) => {
        const current = typeof prev === 'number' ? prev : timeIndex
        const next = current + 1
        if (next >= steps.length - 1) {
          setPlaying(false)
          return steps.length - 1
        }
        return next
      })
    }, 400)
    return () => window.clearInterval(id)
  }, [playing, onTimeIndexChange, steps.length, timeIndex])

  const thumbLeft = steps.length > 1 ? (timeIndex / (steps.length - 1)) * 100 : 0
  const nowLeft =
    steps.length > 1 ? (currentTimeIndex / (steps.length - 1)) * 100 : 0

  let lastDay = ''

  return (
    <div className="timeline-bar" role="group" aria-label="Forecast timeline">
      <button
        type="button"
        className={`timeline-bar__play${playing ? ' timeline-bar__play--active' : ''}`}
        onClick={() => setPlaying((p) => !p)}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <div className="timeline-bar__main">
        <div className="timeline-bar__days">
          {steps.map((step, i) => {
            const day = formatDayLabel(step)
            const showDay = day !== lastDay
            if (showDay) lastDay = day
            return (
              <div
                key={`d-${i}`}
                className="timeline-bar__tick"
                style={{ left: `${(i / (steps.length - 1)) * 100}%` }}
              >
                {showDay && <span className="timeline-bar__day">{day}</span>}
              </div>
            )
          })}
        </div>

        <div
          ref={trackRef}
          className="timeline-bar__track"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <div
            className="timeline-bar__now-dot"
            style={{ left: `${nowLeft}%` }}
            title="Now"
          />
          <div className="timeline-bar__thumb" style={{ left: `${thumbLeft}%` }} />
        </div>

        <div className="timeline-bar__hours">
          {steps.map((step, i) => {
            if (!isSynopticHour(step)) return null
            return (
              <div
                key={`h-${i}`}
                className="timeline-bar__tick"
                style={{ left: `${(i / (steps.length - 1)) * 100}%` }}
              >
                <span className="timeline-bar__hour">{formatHourLabel(step)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
