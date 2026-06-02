import { TemperatureGL, latLngToMercator } from './TemperatureGL.js'
import { encodeTemperatureTexture } from './encodeTemperatureTexture.js'
import { boundsFromHeader } from './sampleTemperatureMatrix.js'
import {
  buildTemperatureLut1024,
  logTemperatureRenderDebug,
} from './temperatureLut.js'
import {
  syncWeatherCanvasToMapContainer,
  logTemperatureBoundsDebug,
  countValidTemperatureSamples,
  getMapVisibleBounds,
} from './temperatureCanvasSync.js'

/**
 * @param {HTMLCanvasElement} canvas
 * @param {import('leaflet').Map} map
 * @param {object} options
 */
export function createTemperatureGLOverlay(
  canvas,
  map,
  { sampleMatrix, sampleSize, header, lutSpec },
) {
  const tempGL = new TemperatureGL(canvas)
  const { lut, min: lutMin, max: lutMax } = lutSpec ?? buildTemperatureLut1024()

  const lutRgba = new Uint8Array(lut.length)
  for (let i = 0; i < lut.length; i++) {
    lutRgba[i] = Math.round(lut[i])
  }
  tempGL.setColorLut(lutRgba)

  logTemperatureRenderDebug(sampleMatrix, lut, lutMin, lutMax)

  const encoded = encodeTemperatureTexture(
    sampleMatrix,
    sampleSize,
    lutMin,
    lutMax,
  )
  tempGL.setTemperatureGrid(
    encoded.data,
    encoded.width,
    encoded.height,
    encoded.tempMin,
    encoded.tempMax,
  )

  const bounds = boundsFromHeader(header)
  tempGL.setDataBounds(bounds.west, bounds.south, bounds.east, bounds.north)

  let rafId = null
  let loggedAlignment = false

  function logAlignmentOnce({ width, height }) {
    if (loggedAlignment) return
    loggedAlignment = true

    const visible = map.getBounds()
    logTemperatureBoundsDebug(visible, {
      getNorth: () => bounds.north,
      getSouth: () => bounds.south,
      getEast: () => bounds.east,
      getWest: () => bounds.west,
    }, {
      canvasWidth: width,
      canvasHeight: height,
      gridWidth: encoded.width,
      gridHeight: encoded.height,
      sampleCount: countValidTemperatureSamples(sampleMatrix),
      header,
    })

    const mapVis = getMapVisibleBounds(map)
    console.log('[TemperatureGL] visible vs data', {
      map: mapVis,
      data: bounds,
    })
  }

  function syncCanvas() {
    const { width, height } = syncWeatherCanvasToMapContainer(canvas, map)
    tempGL.resize(width, height)
    return { width, height }
  }

  function updateMercatorCorners(w, h) {
    const nw = map.containerPointToLatLng([0, 0])
    const ne = map.containerPointToLatLng([w, 0])
    const sw = map.containerPointToLatLng([0, h])
    const se = map.containerPointToLatLng([w, h])

    tempGL.setMercatorCorners({
      nw: latLngToMercator(nw.lat, nw.lng),
      ne: latLngToMercator(ne.lat, ne.lng),
      sw: latLngToMercator(sw.lat, sw.lng),
      se: latLngToMercator(se.lat, se.lng),
    })
  }

  function draw() {
    const { width, height } = syncCanvas()
    updateMercatorCorners(width, height)
    logAlignmentOnce({ width, height })
    tempGL.frame()
  }

  function scheduleDraw() {
    if (rafId != null) cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(() => {
      rafId = null
      draw()
    })
  }

  const onMapChange = () => scheduleDraw()

  return {
    start() {
      scheduleDraw()
      map.on('move', onMapChange)
      map.on('zoom', onMapChange)
      map.on('resize', onMapChange)
      console.info('[TemperatureGL] GPU field overlay active')
    },
    redraw: scheduleDraw,
    destroy() {
      if (rafId != null) cancelAnimationFrame(rafId)
      map.off('move', onMapChange)
      map.off('zoom', onMapChange)
      map.off('resize', onMapChange)
      tempGL.destroy()
    },
  }
}
