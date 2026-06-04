export async function fetchWaveLocal() {
  const base = import.meta.env.BASE_URL
  const url = `${base}wave_2019-11-27_00.json`
  console.log('[wave] loading:', url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`[wave] HTTP ${res.status}: ${url}`)
  const raw = await res.json()
  console.log('[wave] loaded, points:', raw[0].data.length)
  return raw[0]  // { header, data }
}
