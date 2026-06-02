import '../styles/maritime.css'

export default function TopBar() {
  return (
    <header className="top-bar">
      <div className="top-bar__spacer" aria-hidden />

      <div className="top-bar__search">
        <span className="top-bar__search-icon" aria-hidden>
          ⌕
        </span>
        <input
          type="text"
          className="top-bar__search-input"
          placeholder="Search location…"
          disabled
          aria-label="Search location"
        />
      </div>

      <button type="button" className="top-bar__settings" aria-label="Settings">
        ⚙
      </button>
    </header>
  )
}
