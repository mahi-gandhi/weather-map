import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { MapRefContext } from '../context/MapRefContext.jsx'
import MapRefBridge from './MapRefBridge.jsx'
import { MapContainer, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import '../styles/maritime.css'
import { fetchECMWF, fetchWaveLocal } from '../lib/fetchWaveLocal'
import { processWaveData } from '../lib/wave-utils.js'
import WaveCanvas from './WaveCanvas'
import WaveParticles from './WaveParticles'
import VectorCanvas from './VectorCanvas.jsx'
import VectorParticles from './VectorParticles.jsx'
import PressureCanvas from './PressureCanvas.jsx'
import LayerSwitcher from './LayerSwitcher'
import ForecastPanel from './ForecastPanel'
import MapInteraction from './MapInteraction'
import MapBoundsController from './MapBoundsController'
import TimelineScrubber from './TimelineScrubber.jsx'
import TopBar from './TopBar.jsx'
import LoadingBar from './LoadingBar.jsx'
import WaveHeightLegend from './WaveHeightLegend.jsx'
import MapTileLoading from './MapTileLoading.jsx'
import LabelsTileLayer from './LabelsTileLayer.jsx'
import {
  buildTimelineSteps,
  getCurrentTimeIndex,
} from '../lib/timeline.js'

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

function getFitWorldZoom(containerWidth) {
  const idealZoom = Math.log2(containerWidth / 256)
  return Math.max(1, Math.ceil(idealZoom))
}

export default function WeatherMap() {
  const timelineSteps = useMemo(() => buildTimelineSteps(), [])
  const currentTimeIndex = useMemo(
    () => getCurrentTimeIndex(timelineSteps),
    [timelineSteps],
  )

  const [activeLayer, setActiveLayer] = useState('wave')
  const [timeIndex, setTimeIndex] = useState(currentTimeIndex)
  const [legacyWaveData, setLegacyWaveData] = useState(null)
  const [ecmwfData, setEcmwfData] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState('')
  const [clickPosition, setClickPosition] = useState(null)
  const [tilesLoading, setTilesLoading] = useState(false)
  const boundsBoxRef = useRef(null)
  const isFetchingRef = useRef({})
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)
  const [initialZoom, setInitialZoom] = useState(null)

  useLayoutEffect(() => {
    const container = mapContainerRef.current
    if (!container) return
    setInitialZoom(getFitWorldZoom(container.offsetWidth))
  }, [])

  const loadLayer = useCallback(
    async ({ showSpinner = true } = {}) => {
      if (isFetchingRef.current.wave) {
        console.warn('[WeatherMap] wave fetch skipped - already in flight')
        return null
      }
      isFetchingRef.current.wave = true
      if (showSpinner) {
        setLoading(true)
        setLoadingLabel('Loading wave data...')
      }
      try {
        const rawWaveData = await fetchWaveLocal()
        const waveData = processWaveData(rawWaveData)
        setLegacyWaveData(waveData)
        return waveData
      } catch (err) {
        console.error('[WeatherMap] failed to load wave', err)
        return null
      } finally {
        isFetchingRef.current.wave = false
        if (showSpinner) {
          setLoading(false)
          setLoadingLabel('')
        }
      }
    },
    [],
  )

  useEffect(() => {
    const datetime = '2026-06-12_06'
    const variables = ['wave', 'wind', 'swell', 'wavcomb', 'pressur']

    Promise.all(
      variables.map((v) =>
        fetchECMWF(v, datetime)
          .then((data) => ({ variable: v, data }))
          .catch((e) => {
            console.error(`[ECMWF] failed to load ${v}:`, e)
            return null
          }),
      ),
    ).then((results) => {
      const loaded = {}
      results.forEach((r) => {
        if (r) loaded[r.variable] = r.data
      })
      console.log('[ECMWF] loaded variables:', Object.keys(loaded))
      setEcmwfData(loaded)
    })
  }, [])

  useEffect(() => {
    if (!legacyWaveData) {
      loadLayer({ showSpinner: true })
    }
  }, [legacyWaveData, loadLayer])

  const handleBoundsChange = useCallback((bounds) => {
    const next = boundsBoxFromLeaflet(bounds)
    const prev = boundsBoxRef.current
    if (
      prev &&
      prev.south === next.south &&
      prev.north === next.north &&
      prev.west === next.west &&
      prev.east === next.east
    ) {
      return
    }
    boundsBoxRef.current = next
    isFetchingRef.current = {}
  }, [])

  const handleZoomBucketChange = useCallback(() => {
    isFetchingRef.current = {}
  }, [])

  const handleLayerChange = useCallback((layerId) => {
    setActiveLayer(layerId)
  }, [])

  const handleTimeIndexChange = useCallback((index) => {
    setTimeIndex(index)
  }, [])

  const handleTilesLoadingChange = useCallback((isLoading) => {
    setTilesLoading(isLoading)
  }, [])

  const showWaveLegend = activeLayer === 'wave'
  const waveGridData = legacyWaveData ?? null
  const landMask = legacyWaveData?.landMask ?? null

  return (
    <MapRefContext.Provider value={mapRef}>
      <div className="maritime-app">
        <div className="maritime-app__map" ref={mapContainerRef}>
          {initialZoom != null && (
            <MapContainer
              center={[20, 0]}
              zoom={initialZoom}
              maxZoom={18}
              worldCopyJump={false}
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

              {activeLayer === 'wave' && ecmwfData.wave && (
                <>
                  <WaveCanvas ecmwfWave={ecmwfData.wave} waveData={legacyWaveData} />
                  <WaveParticles
                    ecmwfWave={ecmwfData.wave}
                    waveData={legacyWaveData}
                  />
                </>
              )}

              {activeLayer === 'wind' && ecmwfData.wind && (
                <>
                  <VectorCanvas
                    ecmwfLayer={ecmwfData.wind}
                    colorScheme="wind"
                    oceanMask={landMask}
                  />
                  <VectorParticles
                    ecmwfLayer={ecmwfData.wind}
                    colorScheme="wind"
                    oceanMask={landMask}
                  />
                </>
              )}

              {activeLayer === 'swell' && ecmwfData.swell && (
                <>
                  <VectorCanvas
                    ecmwfLayer={ecmwfData.swell}
                    colorScheme="swell"
                    oceanMask={landMask}
                  />
                  <VectorParticles
                    ecmwfLayer={ecmwfData.swell}
                    colorScheme="swell"
                    oceanMask={landMask}
                  />
                </>
              )}

              {activeLayer === 'wavcomb' && ecmwfData.wavcomb && (
                <>
                  <VectorCanvas
                    ecmwfLayer={ecmwfData.wavcomb}
                    colorScheme="wave"
                    oceanMask={landMask}
                  />
                  <VectorParticles
                    ecmwfLayer={ecmwfData.wavcomb}
                    colorScheme="wave"
                    oceanMask={landMask}
                  />
                </>
              )}

              {activeLayer === 'pressur' && ecmwfData.pressur && (
                <PressureCanvas ecmwfPressure={ecmwfData.pressur} />
              )}

              <MapInteraction onMapClick={setClickPosition} />

              <ForecastPanel
                position={clickPosition}
                onClose={() => setClickPosition(null)}
                activeLayer={activeLayer}
                waveGridData={waveGridData?.data ?? null}
              />
            </MapContainer>
          )}
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
          <WaveHeightLegend visible={showWaveLegend} />
        </div>
      </div>
    </MapRefContext.Provider>
  )
}
