import '../styles/maritime.css'

const LAYERS = [
  { id: 'wave_height', icon: '🌊', label: 'Waves' },
  { id: 'temperature', icon: '🌡', label: 'Temp' },
]

export default function LayerSwitcher({
  activeLayer,
  onLayerChange,
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
              data-layer={id}
              onClick={() => onLayerChange(id)}
            >
              <span className="layer-pill__icon">{icon}</span>
              <span className="layer-pill__label">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
