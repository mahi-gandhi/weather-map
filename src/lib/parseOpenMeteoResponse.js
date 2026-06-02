/**
 * Normalize Open-Meteo multi-location JSON into per-point entries.
 * @param {unknown} json
 * @param {number} expectedCount
 * @param {{ preserveAllHours?: boolean }} [options]
 * @returns {object[]}
 */
export function parseOpenMeteoEntries(json, expectedCount, options = {}) {
  const { preserveAllHours = false } = options

  if (Array.isArray(json)) {
    return json
  }

  if (json?.error) {
    throw new Error(json.reason || json.error)
  }

  // Single-location response
  if (json?.hourly && !Array.isArray(json.latitude)) {
    return [json]
  }

  // Consolidated multi-location: parallel arrays on one object
  if (json?.hourly && Array.isArray(json.latitude)) {
    const n = json.latitude.length
    const entries = []

    for (let i = 0; i < n; i++) {
      const hourly = {}
      for (const [key, series] of Object.entries(json.hourly)) {
        if (Array.isArray(series) && Array.isArray(series[0])) {
          hourly[key] = preserveAllHours
            ? (series[i] ?? [])
            : [series[i]?.[0] ?? null]
        } else if (Array.isArray(series)) {
          hourly[key] = preserveAllHours ? series : [series[i] ?? null]
        } else {
          hourly[key] = preserveAllHours ? [series] : [series]
        }
      }
      entries.push({
        latitude: json.latitude[i],
        longitude: json.longitude[i],
        hourly,
      })
    }

    return entries
  }

  console.warn(
    '[parseOpenMeteoEntries] unexpected shape, expected',
    expectedCount,
    'entries',
  )
  return [json]
}
