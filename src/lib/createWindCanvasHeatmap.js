import { buildPhysicalColorLut } from './colorLut.js'
import { lookupGridBilinear } from './lookupGrid.js'
import { createSmoothCanvasOverlay } from './smoothCanvasOverlay.js'
import { WINDY_PHYSICAL_STOPS } from './windColorRamp.js'

/**
 * Wind speed heatmap on Canvas 2D (smooth, geo-aligned).
 * @param {HTMLCanvasElement} canvas
 * @param {object} options
 * @param {object} options.header
 * @param {ArrayLike<number>} options.u
 * @param {ArrayLike<number>} options.v
 * @param {ArrayLike<number>} [options.speed]
 * @param {import('leaflet').Map} options.map
 */
export function createWindCanvasHeatmap(canvas, { header, u, v, speed, map }) {
  const speedGrid =
    speed ??
    Array.from({ length: u.length }, (_, i) => Math.hypot(u[i] ?? 0, v[i] ?? 0))

  const { lut, min, max } = buildPhysicalColorLut(
    WINDY_PHYSICAL_STOPS,
    0.5,
  )

  return createSmoothCanvasOverlay(canvas, map, {
    getValueAtLatLng: (lat, lng) =>
      lookupGridBilinear(header, speedGrid, lat, lng),
    lut,
    lutMin: min,
    lutMax: max,
    minVisible: 0.5,
    opacity: 0.75,
  })
}

/** @deprecated Use LUT via buildPhysicalColorLut */
export function windHeatmapColor(speedKmh) {
  const s = Math.max(0, speedKmh)
  const stops = [
    { v: 0, rgb: [0x0a, 0x1f, 0x6e] },
    { v: 20, rgb: [0x00, 0xc8, 0xff] },
    { v: 50, rgb: [0xff, 0xff, 0x00] },
    { v: 80, rgb: [0xff, 0x00, 0x00] },
  ]

  if (s <= stops[0].v) return stops[0].rgb
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (s <= b.v) {
      const t = (s - a.v) / (b.v - a.v)
      return [
        Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t),
        Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t),
        Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t),
      ]
    }
  }
  return stops[stops.length - 1].rgb
}
