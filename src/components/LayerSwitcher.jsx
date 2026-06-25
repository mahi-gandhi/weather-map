import '../styles/maritime.css'

const LAYERS = [
  { id: 'wave', label: 'Waves' },
  { id: 'wind', label: 'Wind' },
  { id: 'swell', label: 'Swell' },
  { id: 'wavcomb', label: 'Combined' },
  { id: 'pressur', label: 'Pressure' },
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
        {LAYERS.map(({ id, label }) => {
          const isActive = activeLayer === id
          return (
            <button
              key={id}
              type="button"
              className={`layer-btn layer-pill${isActive ? ' active layer-pill--active' : ''}`}
              data-layer={id}
              onClick={() => onLayerChange(id)}
            >
              <span className="layer-pill__label">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
