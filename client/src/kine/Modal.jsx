export default function Modal({ open, onClose, titulo, children }) {
  if (!open) return null
  return (
    <div className="kine-modal-overlay" onClick={onClose}>
      <div className="kine-modal" onClick={e => e.stopPropagation()}>
        <div className="kine-modal-header">
          <h2 className="kine-modal-titulo">{titulo}</h2>
          <button className="kine-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="kine-modal-body">{children}</div>
      </div>
    </div>
  )
}
