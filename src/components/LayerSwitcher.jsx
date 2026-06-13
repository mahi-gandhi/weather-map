import '../styles/maritime.css'

const LAYERS = [
  { id: 'isobars', icon: '〰', label: 'Isobars' },
  { id: 'wave_height', icon: '🌊', label: 'Waves' },
  { id: 'wind', icon: '💨', label: 'Wind' },
  { id: 'precipitation', icon: '🌧', label: 'Rain' },
  { id: 'ocean_current', icon: '🔄', label: 'Current' },
  { id: 'temperature', icon: '🌡', label: 'Temp' },
]

export default function LayerSwitcher({
  activeLayer,
  onLayerChange,
  windMode,
  onWindModeChange,
  windParticlesReady = false,
  tilesLoading = false,
}) {
  return (
    <div
      className={`layer-strip${tilesLoading ? ' layer-strip--tiles-loading' : ''}`}
      role="toolbar"
      aria-label="Map layers"
    >
      <div className="layer-strip__pills">
        {LAYERS.map(({ id, icon, label }) => {
          const isActive = activeLayer === id
          return (
            <button
              key={id}
              type="button"
              className={`layer-pill${isActive ? ' layer-pill--active' : ''}`}
              onClick={() => onLayerChange(id)}
            >
              <span className="layer-pill__icon">{icon}</span>
              <span className="layer-pill__label">{label}</span>
            </button>
          )
        })}
      </div>

      {activeLayer === 'wind' && (
        <div className="layer-strip__wind-mode">
          <button
            type="button"
            className={`layer-mode-btn${windMode === 'particles' ? ' layer-mode-btn--active' : ''}`}
            onClick={() => onWindModeChange('particles')}
          >
            Particles
          </button>
          <button
            type="button"
            className={`layer-mode-btn${windMode === 'heatmap' ? ' layer-mode-btn--active' : ''}`}
            onClick={() => onWindModeChange('heatmap')}
          >
            Map
          </button>
          {windParticlesReady && (
            <span className="layer-strip__hint">WebGL</span>
          )}
        </div>
      )}
    </div>
  )
}
