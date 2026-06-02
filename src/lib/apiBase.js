/** Use Vite dev proxy in browser; direct URLs in production preview. */
const useProxy = import.meta.env.DEV

export const OPEN_METEO_FORECAST = useProxy
  ? '/openmeteo/v1/forecast'
  : 'https://api.open-meteo.com/v1/forecast'

export const OPEN_METEO_MARINE = useProxy
  ? '/marine/v1/marine'
  : 'https://marine-api.open-meteo.com/v1/marine'

export const NOMADS_FILTER = useProxy
  ? '/nomads/cgi-bin/filter_gfs_0p25.pl'
  : 'https://nomads.ncep.noaa.gov/cgi-bin/filter_gfs_0p25.pl'
