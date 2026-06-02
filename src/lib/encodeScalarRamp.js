import { LAYERS } from './layers.js'
import { encodeLayerRamp } from './encodeLayerRamp.js'

/** @deprecated Use encodeLayerRamp with LAYERS.wave_height */
export function encodeScalarRamp(grid) {
  return encodeLayerRamp(grid, LAYERS.wave_height)
}
