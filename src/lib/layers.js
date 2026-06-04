import { WINDY_PHYSICAL_STOPS } from './windColorRamp.js'

/** @typedef {'scalar' | 'vector' | 'current'} LayerType */

/**
 * @typedef {object} LayerConfig
 * @property {string} id
 * @property {string} label
 * @property {string} icon
 * @property {string} unit
 * @property {LayerType} type
 * @property {'marine' | 'forecast' | 'static'} api
 * @property {string[]} hourlyParams
 * @property {boolean} [physicalRamp]
 * @property {number} [minVisible]
 * @property {{ value: number, rgba: [number, number, number, number] }[]} [physicalStops]
 * @property {{ pos: number, rgba: [number, number, number, number] }[]} [ramp]
 * @property {number} [zeroThreshold]
 */

/** @type {Record<string, LayerConfig>} */
export const LAYERS = {
  wave_height: {
    id: 'wave_height',
    label: 'Waves',
    icon: '🌊',
    unit: 'm',
    type: 'scalar',
    api: 'static',
    hourlyParams: [],
    physicalRamp: true,
    minVisible: 0,
    physicalStops: [
      { value: 0.5, rgba: [0, 80, 200, 180] },
      { value: 1.0, rgba: [0, 140, 255, 190] },
      { value: 1.5, rgba: [0, 200, 255, 195] },
      { value: 2.0, rgba: [0, 255, 200, 200] },
      { value: 3.0, rgba: [100, 255, 100, 205] },
      { value: 4.0, rgba: [255, 255, 0, 210] },
      { value: 5.0, rgba: [255, 150, 0, 215] },
      { value: 6.0, rgba: [255, 50, 0, 220] },
    ],
  },
  wind: {
    id: 'wind',
    label: 'Wind',
    icon: '💨',
    unit: 'km/h',
    type: 'vector',
    api: 'forecast',
    hourlyParams: ['wind_speed_10m', 'wind_direction_10m'],
    physicalRamp: true,
    minVisible: 0.5,
    physicalStops: WINDY_PHYSICAL_STOPS,
  },
  ocean_current: {
    id: 'ocean_current',
    label: 'Current',
    icon: '🔄',
    unit: 'kn',
    type: 'current',
    api: 'marine',
    hourlyParams: ['ocean_current_velocity', 'ocean_current_direction'],
  },
  precipitation: {
    id: 'precipitation',
    label: 'Rain',
    icon: '🌧',
    unit: 'mm/h',
    type: 'scalar',
    api: 'forecast',
    hourlyParams: ['precipitation'],
    physicalRamp: true,
    minVisible: 0.05,
    noDataMessage: 'No precipitation in this area',
    physicalStops: [
      { value: 0,   rgba: [0,   0,   0,   0] },
      { value: 0.1, rgba: [100, 180, 255, 100] },
      { value: 0.5, rgba: [50,  120, 255, 150] },
      { value: 1,   rgba: [0,   80,  255, 180] },
      { value: 2,   rgba: [0,   200, 100, 200] },
      { value: 5,   rgba: [255, 220, 0,   210] },
      { value: 10,  rgba: [255, 100, 0,   220] },
      { value: 20,  rgba: [255, 0,   0,   230] },
    ],
  },
  temperature: {
    id: 'temperature',
    label: 'Temperature',
    icon: '🌡️',
    unit: '°C',
    type: 'scalar',
    api: 'forecast',
    hourlyParams: ['temperature_2m'],
    physicalRamp: true,
    minVisible: -100,
    physicalStops: [
      { value: -40, rgba: [0, 0, 255, 220] },
      { value: -20, rgba: [0, 128, 255, 220] },
      { value: 0, rgba: [0, 255, 255, 220] },
      { value: 10, rgba: [0, 255, 128, 220] },
      { value: 20, rgba: [128, 255, 0, 220] },
      { value: 30, rgba: [255, 255, 0, 220] },
      { value: 40, rgba: [255, 128, 0, 230] },
      { value: 50, rgba: [255, 0, 0, 230] },
    ],
  },
}

/** Display order for the layer switcher. */
export const LAYER_ORDER = [
  'wave_height',
  'wind',
  'precipitation',
  'ocean_current',
  'temperature',
]

export const LAYER_IDS = LAYER_ORDER

export const GLOBAL_HEADER = {
  nx: 360,
  ny: 181,
  lo1: -180,
  lo2: 179,
  la1: 90,
  la2: -90,
  dx: 1,
  dy: 1,
}
