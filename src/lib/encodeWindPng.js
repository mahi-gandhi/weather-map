import { imageDataToDataUrl } from './imageDataToUrl.js'
import { sampleWindyColor } from './windColorRamp.js'

const MS_TO_KMH = 3.6

/**
 * Encode wind speed (km/h) as a Windy-style color PNG texture.
 * @param {number[]} speedKmh
 * @param {{ nx: number, ny: number }} header
 * @returns {{ pngUrl: string }}
 */
export function encodeWindSpeedKmhPng(speedKmh, header) {
  const { nx, ny } = header
  const count = nx * ny
  const imageData = new ImageData(nx, ny)
  const pixels = imageData.data

  for (let i = 0; i < count; i++) {
    const speed = speedKmh[i] ?? 0
    const [r, g, b, a] = sampleWindyColor(speed)
    const offset = i * 4
    pixels[offset] = r
    pixels[offset + 1] = g
    pixels[offset + 2] = b
    pixels[offset + 3] = a
  }

  return {
    pngUrl: imageDataToDataUrl(imageData),
  }
}

/**
 * Encode wind speed (km/h) from m/s U/V components.
 * @param {number[]} uMs — eastward m/s
 * @param {number[]} vMs — northward m/s
 * @param {{ nx: number, ny: number }} header
 * @returns {{ pngUrl: string }}
 */
export function encodeWindPng(uMs, vMs, header) {
  const speedKmh = buildSpeedGridKmh(uMs, vMs)
  return encodeWindSpeedKmhPng(speedKmh, header)
}

/**
 * @param {number[]} uMs
 * @param {number[]} vMs
 * @returns {number[]}
 */
export function buildSpeedGridKmh(uMs, vMs) {
  return uMs.map((u, i) => Math.hypot(u, vMs[i]) * MS_TO_KMH)
}
