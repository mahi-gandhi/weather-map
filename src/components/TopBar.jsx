import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMapRef } from '../context/MapRefContext.jsx'
import '../styles/maritime.css'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export default function TopBar() {
  const mapRef = useMapRef()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const debounceRef = useRef(null)
  const wrapRef = useRef(null)

  const search = useCallback(async (q) => {
    if (!q || q.length < 2) {
      setResults([])
      return
    }
    const url =
      `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=5`
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error('search failed')
      const json = await res.json()
      setResults(Array.isArray(json) ? json : [])
      setOpen(true)
    } catch {
      setResults([])
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query.trim()), 350)
    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const goToResult = (item) => {
    const map = mapRef?.current
    if (!map) return
    const lat = parseFloat(item.lat)
    const lon = parseFloat(item.lon)
    const zoom = Math.min(12, Math.max(4, parseInt(item.importance * 4, 10) || 8))
    map.setView([lat, lon], zoom, { animate: true })
    const name = item.display_name?.split(',')[0] ?? item.name ?? 'Location'
    setToast(name)
    setQuery(name)
    setOpen(false)
    setResults([])
  }

  return (
    <header className="top-bar">
      <div className="top-bar__spacer" aria-hidden />

      <div className="top-bar__search-wrap" ref={wrapRef}>
        <div className="top-bar__search">
          <span className="top-bar__search-icon" aria-hidden>
            ⌕
          </span>
          <input
            type="text"
            className="top-bar__search-input"
            placeholder="Search location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            aria-label="Search location"
            autoComplete="off"
          />
        </div>
        {open && results.length > 0 && (
          <ul className="top-bar__search-results" role="listbox">
            {results.map((item) => (
              <li key={item.place_id}>
                <button
                  type="button"
                  className="top-bar__search-result"
                  onClick={() => goToResult(item)}
                >
                  {item.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="top-bar__settings" aria-label="Settings">
        ⚙
      </button>

      {toast &&
        mapRef?.current &&
        createPortal(
          <div className="map-location-toast" role="status">
            {toast}
          </div>,
          mapRef.current.getContainer(),
        )}
    </header>
  )
}
