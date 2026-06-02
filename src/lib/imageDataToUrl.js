/**
 * @param {ImageData} imageData
 * @returns {string}
 */
export function imageDataToDataUrl(imageData) {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('imageDataToDataUrl: could not get 2d context')
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}
