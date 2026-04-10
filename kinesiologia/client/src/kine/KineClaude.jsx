import { useEffect, useRef, useState } from 'react'

const TOOL_LABELS = {
  read_file:       'Leyendo archivo',
  write_file:      'Escribiendo archivo',
  edit_file:       'Editando archivo',
  list_directory:  'Listando directorio',
  execute_command: 'Ejecutando comando',
  search_in_files: 'Buscando en archivos',
}

function MensajeItem({ msg }) {
  if (msg.rol === 'user') return (
    <div className="chat-msg chat-user">
      <div className="chat-bubble chat-bubble-user">{msg.texto}</div>
    </div>
  )
  return (
    <div className="chat-msg chat-assistant">
      <div className="chat-avatar">C</div>
      <div className="chat-contenido">
        {msg.herramientas?.map((h, i) => (
          <div key={i} className={`chat-tool ${h.ok === true ? 'tool-ok' : h.ok === false ? 'tool-error' : ''}`}>
            <span className="tool-icon">{h.ok === true ? '✓' : h.ok === false ? '✗' : '…'}</span>
            <span className="tool-nombre">{TOOL_LABELS[h.nombre] || h.nombre}</span>
            {h.path && <span className="tool-path">{h.path}</span>}
          </div>
        ))}
        {msg.texto && (
          <div className="chat-bubble chat-bubble-assistant">
            <span style={{ whiteSpace: 'pre-wrap' }}>{msg.texto}</span>
            {msg.escribiendo && <span className="cursor-blink">▌</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function KineClaude() {
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [conectado, setConectado] = useState(false)
  const wsRef = useRef(null)
  const feedRef = useRef(null)

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [mensajes])

  useEffect(() => {
    let ws
    let shouldReconnect = true

    function connect() {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      ws = new WebSocket(`${wsProtocol}//${window.location.host}`)
      wsRef.current = ws
      ws.onopen = () => setConectado(true)
      ws.onclose = () => {
        setConectado(false)
        if (shouldReconnect) setTimeout(connect, 2000)
      }
      ws.onmessage = (raw) => {
        const evento = JSON.parse(raw.data)
        if (!evento.tipo.startsWith('claude_')) return

        if (evento.tipo === 'claude_token') {
          setMensajes(prev => {
            const last = prev[prev.length - 1]
            if (last?.rol === 'assistant') {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, texto: (last.texto || '') + evento.token, escribiendo: true }
              return updated
            }
            return [...prev, { rol: 'assistant', texto: evento.token, herramientas: [], escribiendo: true }]
          })
        } else if (evento.tipo === 'claude_herramienta') {
          const pathInfo = evento.input?.path || evento.input?.command || evento.input?.directory || ''
          setMensajes(prev => {
            const last = prev[prev.length - 1]
            const herr = { nombre: evento.nombre, path: pathInfo, ok: null }
            if (last?.rol === 'assistant') {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, herramientas: [...(last.herramientas || []), herr] }
              return updated
            }
            return [...prev, { rol: 'assistant', texto: '', herramientas: [herr], escribiendo: true }]
          })
        } else if (evento.tipo === 'claude_herramienta_ok' || evento.tipo === 'claude_herramienta_error') {
          const ok = evento.tipo === 'claude_herramienta_ok'
          setMensajes(prev => {
            const last = prev[prev.length - 1]
            if (!last?.herramientas) return prev
            const updated = [...prev]
            const herrs = [...last.herramientas]
            const idx = herrs.map(h => h.nombre).lastIndexOf(evento.nombre)
            if (idx >= 0) herrs[idx] = { ...herrs[idx], ok }
            updated[updated.length - 1] = { ...last, herramientas: herrs }
            return updated
          })
        } else if (evento.tipo === 'claude_done') {
          setMensajes(prev => {
            if (!prev.length) return prev
            const updated = [...prev]
            updated[updated.length - 1] = { ...updated[updated.length - 1], escribiendo: false }
            return updated
          })
          setEnviando(false)
        } else if (evento.tipo === 'claude_error') {
          setMensajes(prev => [...prev, { rol: 'assistant', texto: `Error: ${evento.mensaje}`, herramientas: [] }])
          setEnviando(false)
        }
      }
    }

    connect()
    return () => { shouldReconnect = false; ws?.close() }
  }, [])

  function enviar(e) {
    e.preventDefault()
    const msg = input.trim()
    if (!msg || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || enviando) return
    wsRef.current.send(JSON.stringify({ tipo: 'claude_message', texto: msg }))
    setMensajes(prev => [...prev, { rol: 'user', texto: msg }])
    setInput('')
    setEnviando(true)
  }

  function limpiar() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo: 'claude_limpiar' }))
    }
    setMensajes([])
    setEnviando(false)
  }

  return (
    <div className="kine-claude-wrap">
      <div className="claude-chat" style={{ maxWidth: '100%', borderLeft: 'none', borderRight: 'none' }}>
        <div className="claude-chat-header">
          <span className="claude-chat-titulo">Claude</span>
          <span className="claude-chat-sub">
            {conectado
              ? 'Asistente con acceso al sistema'
              : 'Reconectando...'}
          </span>
          <button className="claude-limpiar-btn" onClick={limpiar} title="Nueva conversación">↺</button>
        </div>

        <div className="claude-feed" ref={feedRef}>
          {mensajes.length === 0 && (
            <div className="claude-empty">
              <p>Hola Augusto. Puedo ayudarte con tus pacientes, ejercicios, programar nuevas funciones y más.</p>
              <p className="claude-empty-hint">Ejemplo: "asigná el ejercicio de sentadilla al paciente García" o "mostrá los pacientes con lesión activa"</p>
            </div>
          )}
          {mensajes.map((m, i) => <MensajeItem key={i} msg={m} />)}
          {enviando && mensajes[mensajes.length - 1]?.rol === 'user' && (
            <div className="chat-msg chat-assistant">
              <div className="chat-avatar">C</div>
              <div className="chat-pensando"><span /><span /><span /></div>
            </div>
          )}
        </div>

        <form className="claude-input-wrap" onSubmit={enviar}>
          <textarea
            className="claude-input"
            placeholder={conectado ? 'Escribí tu mensaje... (Enter para enviar, Shift+Enter para nueva línea)' : 'Sin conexión...'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(e) } }}
            disabled={!conectado || enviando}
            rows={1}
          />
          <button className="claude-send-btn" type="submit" disabled={!conectado || !input.trim() || enviando}>
            {enviando ? '...' : '↑'}
          </button>
        </form>
      </div>
    </div>
  )
}
