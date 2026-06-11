/** Open-Meteo base URLs — Vite proxy in dev to avoid CORS. */
const isProd = import.meta.env.PROD

const forecastBase = isProd ? 'https://api.open-meteo.com' : '/openmeteo'
const marineBase = isProd ? 'https://marine-api.open-meteo.com' : '/marine'

export const OPEN_METEO_FORECAST = `${forecastBase}/v1/forecast`
export const OPEN_METEO_MARINE = `${marineBase}/v1/marine`

export const NOMADS_FILTER = isProd
  ? 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl'
  : '/nomads/cgi-bin/filter_gfs_0p25.pl'
