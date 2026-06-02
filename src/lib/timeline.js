export const TIMELINE_DAYS = 10
export const TIMELINE_STEP_HOURS = 3
export const TIMELINE_STEPS = (TIMELINE_DAYS * 24) / TIMELINE_STEP_HOURS

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * @param {Date} date
 */
export function floorTo3Hours(date) {
  const d = new Date(date)
  const h = d.getUTCHours()
  const floored = h - (h % TIMELINE_STEP_HOURS)
  d.setUTCHours(floored, 0, 0, 0)
  return d
}

/**
 * @returns {Date[]}
 */
export function buildTimelineSteps() {
  const start = floorTo3Hours(new Date())
  const steps = []
  for (let i = 0; i < TIMELINE_STEPS; i++) {
    steps.push(
      new Date(start.getTime() + i * TIMELINE_STEP_HOURS * 60 * 60 * 1000),
    )
  }
  return steps
}

/**
 * @param {Date[]} steps
 */
export function getCurrentTimeIndex(steps) {
  const now = Date.now()
  let best = 0
  let bestDiff = Infinity

  for (let i = 0; i < steps.length; i++) {
    const diff = Math.abs(steps[i].getTime() - now)
    if (diff < bestDiff) {
      bestDiff = diff
      best = i
    }
  }

  return best
}

/**
 * @param {Date} date
 */
export function formatDayLabel(date) {
  return DAY_NAMES[date.getUTCDay()]
}

/**
 * @param {Date} date
 */
export function formatHourLabel(date) {
  const h = date.getUTCHours()
  return String(h).padStart(2, '0')
}

/**
 * @param {Date} date
 */
export function isSynopticHour(date) {
  const h = date.getUTCHours()
  return h === 0 || h === 6 || h === 12 || h === 18
}

/**
 * @param {Date} forecastTime
 * @param {Date} baseTime
 */
export function hoursFromBase(forecastTime, baseTime) {
  return Math.round((forecastTime.getTime() - baseTime.getTime()) / 3600000)
}
