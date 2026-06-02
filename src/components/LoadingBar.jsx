import '../styles/maritime.css'

export default function LoadingBar({ label }) {
  if (!label) return null

  return (
    <div className="loading-bar" role="status" aria-live="polite">
      <span className="loading-bar__spinner" aria-hidden />
      <span className="loading-bar__text">{label}</span>
    </div>
  )
}
