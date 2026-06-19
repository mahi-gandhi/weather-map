import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MapRefContext } from '../context/MapRefContext.jsx'
import MapRefBridge from './MapRefBridge.jsx'
import { MapContainer, TileLayer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/maritime.css'
import { fetchLayerGrid } from '../lib/fetchOpenMeteo.js'
import { fetchWaveLocal } from '../lib/fetchWaveLocal'
import WeatherOverlay from './WeatherOverlay'
import WaveCanvas from './WaveCanvas'
import WaveParticles from './WaveParticles'
import LayerSwitcher from './LayerSwitcher'
import ForecastPanel from './ForecastPanel'
import MapInteraction from './MapInteraction'
import MapBoundsController from './MapBoundsController'
import TimelineScrubber from './TimelineScrubber.jsx'
import TopBar from './TopBar.jsx'
import LoadingBar from './LoadingBar.jsx'
import TemperatureLegend from './TemperatureLegend.jsx'
import WaveHeightLegend from './WaveHeightLegend.jsx'
import MapTileLoading from './MapTileLoading.jsx'
import LabelsTileLayer from './LabelsTileLayer.jsx'
import {
  buildTimelineSteps,
  getCurrentTimeIndex,
} from '../lib/timeline.js'
import { selectGridsForTime } from '../lib/openMeteoTimeSeries.js'

const TILE_BASE =
  'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png'
const TILE_LABELS =
  'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png'
const TILE_ATTRIBUTION = '© OpenStreetMap contributors © CARTO'

const TILE_LAYER_OPTS = {
  subdomains: 'abcd',
  tileSize: 256,
  maxZoom: 18,
  keepBuffer: 4,
  updateWhenZooming: false,
}

const SERIES_LAYERS = new Set(['temperature'])

const TIME_SENSITIVE_LAYERS = new Set(['temperature'])

const LAYER_LOAD_LABELS = {
  wave_height: 'wave',
  temperature: 'temperature',
}

function roundCoord(value) {
  return Math.round(value * 100) / 100
}

function boundsBoxFromLeaflet(bounds) {
  return {
    south: roundCoord(bounds.getSouth()),
    north: roundCoord(bounds.getNorth()),
    west: roundCoord(bounds.getWest()),
    east: roundCoord(bounds.getEast()),
  }
}

function boundsBoxKey(layerId, box) {
  return [layerId, box.south, box.north, box.west, box.east].join('|')
}

function leafletBoundsFromBox(box) {
  return L.latLngBounds(
    [box.south, box.west],
    [box.north, box.east],
  )
}

export default function WeatherMap() {
  const timelineSteps = useMemo(() => buildTimelineSteps(), [])
  const currentTimeIndex = useMemo(
    () => getCurrentTimeIndex(timelineSteps),
    [timelineSteps],
  )

  const [activeLayer, setActiveLayer] = useState('wave_height')
  const [timeIndex, setTimeIndex] = useState(currentTimeIndex)
  const [layerGrids, setLayerGrids] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState('')
  const [clickPosition, setClickPosition] = useState(null)
  const [tilesLoading, setTilesLoading] = useState(false)
  const [boundsBox, setBoundsBox] = useState(null)
  const fetchKeyRef = useRef('')
  const isFetchingRef = useRef({})
  const timeSeriesCacheRef = useRef(new Map())
  const mapRef = useRef(null)

  const mapBounds = useMemo(() => {
    if (!boundsBox) return null
    return leafletBoundsFromBox(boundsBox)
  }, [boundsBox?.south, boundsBox?.north, boundsBox?.west, boundsBox?.east])

  const loadLayer = useCallback(
    async (layerId, bounds, timeIdx, { showSpinner = true } = {}) => {
      if (!bounds) return null

      if (layerId === 'wave_height') {
        console.log('[wave] early exit hit (WeatherMap.loadLayer)')
        if (isFetchingRef.current.wave_height) {
          console.warn('[WeatherMap] wave_height fetch skipped — already in flight')
          return null
        }
        isFetchingRef.current.wave_height = true
        if (showSpinner) {
          setLoading(true)
          setLoadingLabel('Loading wave data…')
        }
        try {
          console.log('[wave] WeatherMap calling fetchWaveLocal')
          const waveData = await fetchWaveLocal()
          const grids = [waveData]
          console.log('[wave] layerGrids.wave_height:', grids)
          setLayerGrids((prev) => ({ ...prev, wave_height: grids }))
          return grids
        } catch (err) {
          console.error('[WeatherMap] failed to load wave_height', err)
          return null
        } finally {
          isFetchingRef.current.wave_height = false
          if (showSpinner) {
            setLoading(false)
            setLoadingLabel('')
          }
        }
      }

      if (layerId !== 'temperature') return null

      const forecastTime = timelineSteps[timeIdx]
      const cache = timeSeriesCacheRef.current
      const box = boundsBoxFromLeaflet(bounds)
      const cacheKey = boundsBoxKey(layerId, box)

      const series = cache.get(cacheKey)
      if (series) {
        const grids = selectGridsForTime(series, forecastTime)
        setLayerGrids((prev) => ({ ...prev, [layerId]: grids }))
        return grids
      }

      if (isFetchingRef.current[layerId]) {
        console.warn(`[WeatherMap] ${layerId} fetch skipped — already in flight`)
        return null
      }

      isFetchingRef.current[layerId] = true

      if (showSpinner) {
        setLoading(true)
        const name = LAYER_LOAD_LABELS[layerId] ?? layerId
        setLoadingLabel(`Loading ${name} data…`)
      }

      try {
        console.log('[temp] loadLayer start, bounds:', {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        })
        const grids = await fetchLayerGrid(layerId, bounds, {
          forecastTime,
          timeSeriesCache: cache,
        })
        console.log('[temp] loadLayer complete, grids:', grids?.length ?? 0)
        setLayerGrids((prev) => ({ ...prev, [layerId]: grids }))
        return grids
      } catch (err) {
        console.error('[temp] fetch error:', err)
        console.error(`[WeatherMap] failed to load ${layerId}`, err)
        return null
      } finally {
        isFetchingRef.current[layerId] = false
        if (showSpinner) {
          setLoading(false)
          setLoadingLabel('')
        }
      }
    },
    [timelineSteps],
  )

  useEffect(() => {
    if (!boundsBox || !mapBounds) return

    const keyParts = [
      activeLayer,
      boundsBox.south,
      boundsBox.north,
      boundsBox.west,
      boundsBox.east,
    ]
    if (TIME_SENSITIVE_LAYERS.has(activeLayer)) {
      keyParts.push(timeIndex)
    }
    const fetchKey = keyParts.join('|')

    if (fetchKey === fetchKeyRef.current) return

    fetchKeyRef.current = fetchKey

    const isScrub =
      SERIES_LAYERS.has(activeLayer) &&
      timeSeriesCacheRef.current.has(boundsBoxKey(activeLayer, boundsBox))

    loadLayer(activeLayer, mapBounds, timeIndex, {
      showSpinner: !isScrub,
    })
  }, [
    activeLayer,
    boundsBox?.south,
    boundsBox?.north,
    boundsBox?.west,
    boundsBox?.east,
    timeIndex,
    mapBounds,
    loadLayer,
  ])

  const handleBoundsChange = useCallback((bounds) => {
    const next = boundsBoxFromLeaflet(bounds)
    setBoundsBox((prev) => {
      if (
        prev &&
        prev.south === next.south &&
        prev.north === next.north &&
        prev.west === next.west &&
        prev.east === next.east
      ) {
        return prev
      }
      timeSeriesCacheRef.current.clear()
      fetchKeyRef.current = ''
      isFetchingRef.current = {}
      return next
    })
  }, [])

  const handleZoomBucketChange = useCallback(() => {
    timeSeriesCacheRef.current.clear()
    fetchKeyRef.current = ''
    isFetchingRef.current = {}
    if (mapBounds) {
      loadLayer(activeLayer, mapBounds, timeIndex)
    }
  }, [mapBounds, activeLayer, timeIndex, loadLayer])

  const handleLayerChange = useCallback((layerId) => {
    fetchKeyRef.current = ''
    setActiveLayer(layerId)
  }, [])

  const handleTimeIndexChange = useCallback((index) => {
    fetchKeyRef.current = ''
    setTimeIndex(index)
  }, [])

  const handleTilesLoadingChange = useCallback((isLoading) => {
    setTilesLoading(isLoading)
  }, [])

  const activeGrids = layerGrids[activeLayer]
  const showHeatmap = activeLayer === 'temperature'
  const showTemperatureLegend = activeLayer === 'temperature'
  const showWaveLegend = activeLayer === 'wave_height'
  const waveGridData = layerGrids.wave_height?.[0] ?? null

  useEffect(() => {
    if (activeLayer === 'wave_height' && layerGrids.wave_height?.[0]) {
      console.log(
        '[wave] passing to particles:',
        layerGrids.wave_height?.[0]?.data?.length,
      )
    }
  }, [activeLayer, layerGrids.wave_height])

  return (
    <MapRefContext.Provider value={mapRef}>
    <div className="maritime-app">
      <div className="maritime-app__map">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          minZoom={2}
          maxZoom={18}
          worldCopyJump
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution={TILE_ATTRIBUTION}
            url={TILE_BASE}
            {...TILE_LAYER_OPTS}
          />
          <LabelsTileLayer url={TILE_LABELS} {...TILE_LAYER_OPTS} />

          <MapRefBridge mapRef={mapRef} />

          <MapTileLoading onTilesLoadingChange={handleTilesLoadingChange} />

          <MapBoundsController
            onBoundsChange={handleBoundsChange}
            onZoomBucketChange={handleZoomBucketChange}
          />

          {showHeatmap && activeGrids && (
            <WeatherOverlay layerId={activeLayer} grids={activeGrids} />
          )}

          {activeLayer === 'wave_height' && layerGrids.wave_height?.[0] && (
            <>
              <WaveCanvas waveData={layerGrids.wave_height[0]} />
              <WaveParticles waveData={layerGrids.wave_height[0]} />
            </>
          )}

          <MapInteraction onMapClick={setClickPosition} />

          <ForecastPanel
            position={clickPosition}
            onClose={() => setClickPosition(null)}
            activeLayer={activeLayer}
            waveGridData={waveGridData?.data ?? null}
          />
        </MapContainer>
      </div>

      <div className="maritime-app__chrome">
        <TopBar />
        <LoadingBar label={loading ? loadingLabel : ''} />
        <LayerSwitcher
          activeLayer={activeLayer}
          onLayerChange={handleLayerChange}
          tilesLoading={tilesLoading}
        />
        <TimelineScrubber
          timeIndex={timeIndex}
          currentTimeIndex={currentTimeIndex}
          onTimeIndexChange={handleTimeIndexChange}
        />
        <TemperatureLegend visible={showTemperatureLegend} />
        <WaveHeightLegend visible={showWaveLegend} />
      </div>
    </div>
    </MapRefContext.Provider>
  )
}
