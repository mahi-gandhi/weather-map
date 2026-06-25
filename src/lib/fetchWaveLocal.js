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

export async function fetchECMWF(variable, datetime) {
  const base = import.meta.env.BASE_URL
  const url = `${base}data/ECMWFWeatherVisSplit/${variable}/${variable}_${datetime}.json`
  console.log('[ECMWF] EXACT URL:', JSON.stringify(url))
  console.log('[ECMWF] base:', JSON.stringify(base))
  console.log('[ECMWF] variable:', variable)
  console.log('[ECMWF] datetime:', datetime)
  const res = await fetch(url)
  console.log('[ECMWF] response status:', res.status, res.ok)
  console.log(
    '[ECMWF] response content-type:',
    res.headers.get('content-type'),
  )
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}

export async function fetchECMWFHeader(datetime) {
  const base = import.meta.env.BASE_URL
  const url = `${base}data/ECMWFWeatherVisSplit/header/${datetime}.json`
  console.log('[ECMWF] fetching header:', url)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res.json()
}
