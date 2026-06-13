const PRESSURE_FILE = 'pressure_2026-06-13.json'

let pressureFilePromise = null

/**
 * Load static global pressure grid from public/pressure_<date>.json
 * @returns {Promise<{ header: object, data: number[] }>}
 */
export async function fetchPressureLocal() {
  if (!pressureFilePromise) {
    pressureFilePromise = (async () => {
      const base = import.meta.env.BASE_URL
      const url = `${base}${PRESSURE_FILE}`
      console.log('[isobar] loading pressure grid:', url)
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`[isobar] HTTP ${res.status}: ${url}`)
      }
      const raw = await res.json()
      const item = raw[0]
      if (!item?.header || !Array.isArray(item?.data)) {
        throw new Error('[isobar] invalid pressure grid format')
      }
      console.log('[isobar] loaded', item.data.length, 'cells')
      return item
    })().catch((err) => {
      pressureFilePromise = null
      throw err
    })
  }
  return pressureFilePromise
}
