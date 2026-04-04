import { useEffect, useRef, useState } from 'react'
import './App.css'

// ── Helpers ──────────────────────────────────────────────

const TIPO_LABELS = {
  gasto: 'Gasto',
  mov_caja: 'Mov. Caja',
  comprobantes_preview: 'Comprobantes',
  comprobantes_envio: 'Envío',
}

const esPendiente = e =>
  e.estado === 'pendiente' ||
  e.estado === 'esperando_confirmacion' ||
  (e.tipo === 'comprobantes_envio' && (e.estado === 'iniciado' || e.estado === 'enviado'))

const toDateId = ts => new Date(ts).toISOString().split('T')[0]
const todayId = () => new Date().toISOString().split('T')[0]

// ── Lightbox ─────────────────────────────────────────────

function Lightbox({ src, onClose }) {
  return (
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt="comprobante" onClick={e => e.stopPropagation()} />
      <button className="lightbox-close" onClick={onClose}>✕</button>
    </div>
  )
}

// ── Botones confirmación ──────────────────────────────────

function BotonesConfirmacion({ id, sendConfirmacion }) {
  const [resuelto, setResuelto] = useState(null)
  function confirmar(r) { setResuelto(r); sendConfirmacion(id, r) }
  if (resuelto === true)  return <p className="tag tag-ok">Confirmado</p>
  if (resuelto === false) return <p className="tag tag-no">Cancelado</p>
  return (
    <div className="botones-confirmacion">
      <button className="btn-si" onClick={() => confirmar(true)}>Sí</button>
      <button className="btn-no" onClick={() => confirmar(false)}>No</button>
    </div>
  )
}

// ── Detalle del evento Mosca ──────────────────────────────

function EventoDetalle({ evento, onImageClick, sendConfirmacion }) {
  const pendiente = evento.estado === 'pendiente' || evento.estado === 'esperando_confirmacion'

  if (evento.tipo === 'gasto') return (
    <div className="evento-body">
      <div className="evento-row"><span className="lbl">Socio</span><span>{evento.datos.socio}</span></div>
      <div className="evento-row"><span className="lbl">Desc.</span><span>{evento.datos.descripcion}</span></div>
      <div className="evento-row"><span className="lbl">Monto</span><strong>${evento.datos.monto?.toLocaleString('es-AR')}</strong></div>
      {evento.estado === 'registrado' && <p className="tag tag-ok">Registrado</p>}
      {evento.estado === 'cancelado'  && <p className="tag tag-no">Cancelado</p>}
      {pendiente && <BotonesConfirmacion id={evento.id} sendConfirmacion={sendConfirmacion} />}
    </div>
  )

  if (evento.tipo === 'mov_caja') {
    const { datos } = evento
    return (
      <div className="evento-body">
        <div className="evento-row"><span className="lbl">Tipo</span><span>{datos.ingresoEgreso}</span></div>
        <div className="evento-row"><span className="lbl">Monto</span><strong>${datos.monto?.toLocaleString('es-AR')}</strong></div>
        <div className="evento-row"><span className="lbl">Item</span><span>{datos.item}</span></div>
        {datos.caja && <div className="evento-row"><span className="lbl">Caja</span><span>{datos.caja}</span></div>}
        {datos.sede && <div className="evento-row"><span className="lbl">Sede</span><span>{datos.sede}</span></div>}
        {evento.estado === 'registrado' && <p className="tag tag-ok">Registrado</p>}
        {evento.estado === 'cancelado'  && <p className="tag tag-no">Cancelado</p>}
        {pendiente && <BotonesConfirmacion id={evento.id} sendConfirmacion={sendConfirmacion} />}
      </div>
    )
  }

  if (evento.tipo === 'comprobantes_preview') {
    if (evento.estado === 'cancelado') return <p className="tag tag-no">Envío cancelado</p>
    return (
      <div className="evento-body">
        {evento.caption && <p className="caption">"{evento.caption}"</p>}
        <div className="comprobantes-grid">
          {evento.listos?.map((l, i) => (
            <div key={i} className="comprobante-card">
              <img src={l.imagen} alt={l.archivo} className="comprobante-img" onClick={() => onImageClick(l.imagen)} />
              <div className="comprobante-info">
                <span className="comprobante-nombre">{l.contacto}</span>
                <span className="comprobante-tel">+{l.telefono}</span>
              </div>
            </div>
          ))}
        </div>
        {evento.noEncontrados?.length > 0 && (
          <div className="lista">
            {evento.noEncontrados.map((a, i) => (
              <div key={i} className="lista-item error">{a.replace(/\.[^.]+$/, '')} — sin contacto</div>
            ))}
          </div>
        )}
        {evento.duplicados?.length > 0 && (
          <div className="lista">
            {evento.duplicados.map((a, i) => (
              <div key={i} className="lista-item warn">{a.replace(/\.[^.]+$/, '')} — duplicado</div>
            ))}
          </div>
        )}
        {evento.estado === 'esperando_confirmacion' && (
          <BotonesConfirmacion id={evento.id} sendConfirmacion={sendConfirmacion} />
        )}
      </div>
    )
  }

  if (evento.tipo === 'comprobantes_envio') {
    if (evento.estado === 'iniciado') return <p className="evento-body muted">Enviando {evento.total} comprobante(s)...</p>
    if (evento.estado === 'enviado') return (
      <div className="evento-body">
        <p>{evento.archivo?.replace(/\.[^.]+$/, '')} → {evento.contacto}</p>
        <progress value={evento.progreso} max={evento.total} />
        <small>{evento.progreso} / {evento.total}</small>
      </div>
    )
    if (evento.estado === 'error') return <p className="tag tag-no">Error: {evento.archivo?.replace(/\.[^.]+$/, '')}</p>
    if (evento.estado === 'finalizado') return (
      <div className="evento-body">
        <p className="tag tag-ok">Enviados: {evento.enviados?.length}</p>
        {evento.errores?.length > 0 && <p className="tag tag-no">Errores: {evento.errores?.length}</p>}
      </div>
    )
  }

  if (evento.tipo === 'bot_respuesta') return (
    <div className="bot-respuesta">
      <div className="bot-respuesta-header">
        <span className="bot-respuesta-label">Mosca</span>
        <span className="card-hora">{new Date(evento.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <p className="bot-respuesta-texto">{evento.texto}</p>
    </div>
  )

  return null
}

// ── Card Mosca ────────────────────────────────────────────

function EventoCard({ evento, onImageClick, sendConfirmacion }) {
  if (evento.tipo === 'bot_respuesta') {
    return <EventoDetalle evento={evento} onImageClick={onImageClick} sendConfirmacion={sendConfirmacion} />
  }
  const hora = new Date(evento.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
  const label = TIPO_LABELS[evento.tipo] || evento.tipo
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-tipo">{label}</span>
        <span className="card-hora">{hora}</span>
      </div>
      <EventoDetalle evento={evento} onImageClick={onImageClick} sendConfirmacion={sendConfirmacion} />
    </div>
  )
}

// ── Sidebar historial ─────────────────────────────────────

function Sidebar({ eventos, selectedDay, onSelectDay }) {
  const [expanded, setExpanded] = useState({})

  const tree = {}
  eventos.filter(e => !esPendiente(e) && e.tipo !== 'bot_respuesta').forEach(e => {
    const fecha = new Date(e.timestamp)
    const mesKey = fecha.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    const diaId = toDateId(e.timestamp)
    const diaLabel = fecha.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
    if (!tree[mesKey]) tree[mesKey] = {}
    if (!tree[mesKey][diaId]) tree[mesKey][diaId] = { label: diaLabel, count: 0 }
    tree[mesKey][diaId].count++
  })

  useEffect(() => {
    const meses = Object.keys(tree)
    setExpanded(prev => {
      const next = { ...prev }
      meses.forEach(m => { if (!(m in next)) next[m] = true })
      return next
    })
  }, [Object.keys(tree).join()])

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Historial</div>
      {Object.keys(tree).length === 0
        ? <div className="sidebar-empty">Sin actividad aún</div>
        : Object.entries(tree).map(([mes, dias]) => (
            <div key={mes} className="folder">
              <button className="folder-mes" onClick={() => setExpanded(p => ({ ...p, [mes]: !p[mes] }))}>
                <span className="chevron">{expanded[mes] ? '▾' : '▸'}</span>
                <span>{mes}</span>
              </button>
              {expanded[mes] && Object.entries(dias).map(([diaId, { label, count }]) => (
                <button
                  key={diaId}
                  className={`folder-dia ${selectedDay === diaId ? 'active' : ''}`}
                  onClick={() => onSelectDay(selectedDay === diaId ? null : diaId)}
                >
                  <span>{label}</span>
                  <span className="dia-count">{count}</span>
                </button>
              ))}
            </div>
          ))
      }
    </aside>
  )
}

// ── Panel derecho ─────────────────────────────────────────

function PanelDerecho({ eventos, selectedDay, onImageClick, sendConfirmacion }) {
  const dia = selectedDay || todayId()
  const del_dia = eventos.filter(e => !esPendiente(e) && e.tipo !== 'bot_respuesta' && toDateId(e.timestamp) === dia)
  const titulo = selectedDay
    ? new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
    : 'Hoy'
  return (
    <div className="panel-derecho">
      <div className="panel-titulo">{titulo}</div>
      {del_dia.length === 0
        ? <div className="panel-empty">Sin actividad{selectedDay ? '' : ' hoy'}</div>
        : del_dia.map((e, i) => (
            <EventoCard key={i} evento={e} onImageClick={onImageClick} sendConfirmacion={sendConfirmacion} />
          ))
      }
    </div>
  )
}

// ── Input Mosca ───────────────────────────────────────────

function InputMosca({ wsRef, conectado }) {
  const [texto, setTexto] = useState('')
  function enviar(e) {
    e.preventDefault()
    const msg = texto.trim()
    if (!msg || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ tipo: 'mensaje_web', texto: msg }))
    setTexto('')
  }
  return (
    <form className="input-mosca" onSubmit={enviar}>
      <input
        className="input-mosca-field"
        type="text"
        placeholder={conectado ? 'Escribile a Mosca...' : 'Sin conexión...'}
        value={texto}
        onChange={e => setTexto(e.target.value)}
        disabled={!conectado}
        autoComplete="off"
      />
      <button className="input-mosca-btn" type="submit" disabled={!conectado || !texto.trim()}>
        Enviar
      </button>
    </form>
  )
}

// ── Chat Claude ───────────────────────────────────────────

const TOOL_LABELS = {
  read_file:       'Leyendo archivo',
  write_file:      'Escribiendo archivo',
  edit_file:       'Editando archivo',
  list_directory:  'Listando directorio',
  execute_command: 'Ejecutando comando',
  search_in_files: 'Buscando en archivos',
}

function MensajeClaudeItem({ msg }) {
  if (msg.rol === 'user') {
    return (
      <div className="chat-msg chat-user">
        <div className="chat-bubble chat-bubble-user">{msg.texto}</div>
      </div>
    )
  }
  if (msg.rol === 'assistant') {
    return (
      <div className="chat-msg chat-assistant">
        <div className="chat-avatar">C</div>
        <div className="chat-contenido">
          {msg.herramientas?.map((h, i) => (
            <div key={i} className={`chat-tool ${h.ok ? 'tool-ok' : 'tool-error'}`}>
              <span className="tool-icon">{h.ok ? '✓' : '✗'}</span>
              <span className="tool-nombre">{TOOL_LABELS[h.nombre] || h.nombre}</span>
              {h.path && <span className="tool-path">{h.path}</span>}
              {h.error && <span className="tool-error-msg">{h.error}</span>}
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
  return null
}

function ChatClaude({ wsRef, conectado }) {
  const [mensajes, setMensajes] = useState([])
  const [input, setInput] = useState('')
  const [enviando, setEnviando] = useState(false)
  const feedRef = useRef(null)

  // Scroll al fondo cuando hay mensajes nuevos
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [mensajes])

  // Handler global para eventos Claude del WebSocket — registrado desde App
  useEffect(() => {
    window.__claudeHandler = (evento) => {
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
          // Actualizar la última herramienta con ese nombre que esté pendiente
          const idx = herrs.map(h => h.nombre).lastIndexOf(evento.nombre)
          if (idx >= 0) herrs[idx] = { ...herrs[idx], ok, error: evento.error }
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
    return () => { window.__claudeHandler = null }
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
    <div className="claude-chat">
      <div className="claude-chat-header">
        <span className="claude-chat-titulo">Claude</span>
        <span className="claude-chat-sub">Asistente con acceso al sistema</span>
        <button className="claude-limpiar-btn" onClick={limpiar} title="Nueva conversación">↺</button>
      </div>

      <div className="claude-feed" ref={feedRef}>
        {mensajes.length === 0 && (
          <div className="claude-empty">
            <p>Hola Augusto. Puedo ayudarte a programar, modificar Mosca, leer archivos, ejecutar comandos y más.</p>
            <p className="claude-empty-hint">Ejemplo: "mostrá el código del parser" o "agregale a Mosca el comando !saldo"</p>
          </div>
        )}
        {mensajes.map((m, i) => <MensajeClaudeItem key={i} msg={m} />)}
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
          placeholder={conectado ? 'Escribí tu mensaje...' : 'Sin conexión...'}
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
  )
}

// ── App ───────────────────────────────────────────────────

export default function App() {
  const [eventos, setEventos] = useState([])
  const [conectado, setConectado] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [tab, setTab] = useState('mosca') // 'mosca' | 'claude'
  const wsRef = useRef(null)

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
        if (evento.tipo === 'confirmacion_resuelta') return

        // Eventos de Claude van al handler del chat
        if (evento.tipo.startsWith('claude_')) {
          window.__claudeHandler?.(evento)
          return
        }

        if (evento.tipo === 'bot_respuesta') {
          setEventos(prev => [evento, ...prev].slice(0, 200))
          return
        }

        setEventos(prev => {
          const idx = prev.findIndex(e => e.id === evento.id && e.tipo === evento.tipo)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = evento
            return updated
          }
          return [evento, ...prev].slice(0, 200)
        })
      }
    }

    connect()
    return () => { shouldReconnect = false; ws?.close() }
  }, [])

  function sendConfirmacion(id, respuesta) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ tipo: 'confirmacion', id, respuesta: respuesta ? 'si' : 'no' }))
    }
  }

  const pendientes = eventos.filter(esPendiente)
  const respuestasMosca = eventos.filter(e => e.tipo === 'bot_respuesta')

  return (
    <div className="app">
      <nav className="topnav">
        <span className="nav-brand">Pilates Casa Central</span>
        <div className="nav-tabs">
          <button className={`nav-tab ${tab === 'mosca' ? 'active' : ''}`} onClick={() => setTab('mosca')}>
            Mosca
            {pendientes.length > 0 && <span className="nav-tab-badge">{pendientes.length}</span>}
          </button>
          <button className={`nav-tab ${tab === 'claude' ? 'active' : ''}`} onClick={() => setTab('claude')}>
            Claude
          </button>
        </div>
        <span className={`nav-status ${conectado ? 'on' : 'off'}`}>
          {conectado ? '● en línea' : '○ sin conexión'}
        </span>
      </nav>

      {tab === 'mosca' && (
        <div className="layout">
          <Sidebar eventos={eventos} selectedDay={selectedDay} onSelectDay={setSelectedDay} />

          <main className="centro">
            <div className="centro-feed">
              <div className="centro-titulo">
                Pendientes
                {pendientes.length > 0 && <span className="centro-count">{pendientes.length}</span>}
              </div>
              {pendientes.length === 0
                ? <div className="centro-empty">No hay nada pendiente</div>
                : pendientes.map((e, i) => (
                    <EventoCard key={i} evento={e} onImageClick={setLightbox} sendConfirmacion={sendConfirmacion} />
                  ))
              }
              {respuestasMosca.length > 0 && (
                <>
                  <div className="centro-titulo" style={{ marginTop: 24 }}>Respuestas de Mosca</div>
                  {respuestasMosca.map((e, i) => (
                    <EventoCard key={i} evento={e} onImageClick={setLightbox} sendConfirmacion={sendConfirmacion} />
                  ))}
                </>
              )}
            </div>
            <InputMosca wsRef={wsRef} conectado={conectado} />
          </main>

          <PanelDerecho
            eventos={eventos}
            selectedDay={selectedDay}
            onImageClick={setLightbox}
            sendConfirmacion={sendConfirmacion}
          />
        </div>
      )}

      {tab === 'claude' && (
        <div className="layout-claude">
          <ChatClaude wsRef={wsRef} conectado={conectado} />
        </div>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
