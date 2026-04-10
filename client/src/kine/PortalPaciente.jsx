import { useEffect, useState } from 'react'
import { api } from './api.js'

const ALIAS = 'clic.escobar'
const ADMIN_WA = '5491144054833'

/* ── Video embed ─────────────────────────────────────────── */
function VideoEmbed({ url }) {
  if (!url) return null
  let embedUrl = null
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`
  const shortsMatch = url.match(/youtube\.com\/shorts\/([^?&\s]+)/)
  if (shortsMatch) embedUrl = `https://www.youtube.com/embed/${shortsMatch[1]}`
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/)
  if (vimeoMatch) embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`

  if (embedUrl) return (
    <div className="video-embed-wrap">
      <iframe src={embedUrl} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title="Ejercicio" />
    </div>
  )
  return <a href={url} target="_blank" rel="noreferrer" className="kine-ej-video-link">Ver video del ejercicio</a>
}

/* ── Ejercicio detalle ───────────────────────────────────── */
function EjercicioDetalle({ ej, onVolver }) {
  const nombre = ej.nombre.replace(/ — (CC|OA)$/, '')
  return (
    <div className="pp-ej-detalle">
      <button className="pp-btn-volver" onClick={onVolver}>← Volver a la rutina</button>
      <span className="pp-ej-cat-badge">{ej.categoria || 'General'}</span>
      <h2 className="pp-ej-titulo">{nombre}</h2>

      {(ej.series || ej.repeticiones || ej.segundos) && (
        <div className="pp-prescripcion">
          <div className="pp-prescripcion-titulo">Tu prescripción</div>
          <div className="pp-prescripcion-params">
            {ej.series && <div className="pp-param"><span className="pp-param-val">{ej.series}</span><span className="pp-param-lbl">Series</span></div>}
            {ej.repeticiones && <div className="pp-param"><span className="pp-param-val">{ej.repeticiones}</span><span className="pp-param-lbl">Reps</span></div>}
            {ej.segundos && <div className="pp-param"><span className="pp-param-val">{ej.segundos}"</span><span className="pp-param-lbl">Segundos</span></div>}
          </div>
        </div>
      )}

      <VideoEmbed url={ej.video_url} />
      {ej.descripcion && <p className="pp-ej-desc">{ej.descripcion}</p>}
    </div>
  )
}

/* ── Próximo turno destacado ─────────────────────────────── */
function ProximoTurnoCard({ turno }) {
  if (!turno) return null
  const fecha = new Date(turno.fecha + 'T' + turno.hora)
  const diasSemana = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  const hoy = new Date()
  const diffDias = Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24))

  return (
    <div className="pp-proximo-turno">
      <div className="pp-proximo-turno-header">
        <span className="pp-proximo-turno-badge">Próximo turno</span>
        {diffDias <= 1 && <span className="pp-proximo-turno-urgente">¡Mañana!</span>}
        {diffDias === 0 && <span className="pp-proximo-turno-urgente">¡Hoy!</span>}
      </div>
      <div className="pp-proximo-turno-body">
        <div className="pp-proximo-turno-dia">
          <div className="pp-proximo-turno-dianum">{fecha.getDate()}</div>
          <div className="pp-proximo-turno-diames">{meses[fecha.getMonth()]}</div>
        </div>
        <div className="pp-proximo-turno-separador" />
        <div className="pp-proximo-turno-info">
          <div className="pp-proximo-turno-semana">{diasSemana[fecha.getDay()]}</div>
          <div className="pp-proximo-turno-hora">{turno.hora?.slice(0,5)}</div>
          {turno.duracion && <div className="pp-proximo-turno-duracion">{turno.duracion} min</div>}
        </div>
        <div className="pp-proximo-turno-icono">🏃</div>
      </div>
      {turno.motivo && (
        <div className="pp-proximo-turno-motivo">{turno.motivo}</div>
      )}
    </div>
  )
}

/* ── Calendario interactivo ──────────────────────────────── */
function CalendarioInteractivo({ turnos }) {
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth())
  const [anio, setAnio] = useState(hoy.getFullYear())

  const mesesNombre = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const diasNombre = ['D','L','M','X','J','V','S']

  const diasEnMes = new Date(anio, mes + 1, 0).getDate()
  const primerDia = new Date(anio, mes, 1).getDay()

  // Días con turnos en este mes
  const diasConTurno = new Set(
    turnos
      .filter(t => {
        const d = new Date(t.fecha + 'T12:00')
        return d.getMonth() === mes && d.getFullYear() === anio
      })
      .map(t => new Date(t.fecha + 'T12:00').getDate())
  )

  const irMesAnterior = () => {
    if (mes === 0) { setMes(11); setAnio(a => a - 1) }
    else setMes(m => m - 1)
  }
  const irMesSiguiente = () => {
    if (mes === 11) { setMes(0); setAnio(a => a + 1) }
    else setMes(m => m + 1)
  }

  const celdas = []
  for (let i = 0; i < primerDia; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)

  return (
    <div className="pp-cal">
      <div className="pp-cal-nav">
        <button className="pp-cal-nav-btn" onClick={irMesAnterior}>‹</button>
        <span className="pp-cal-mes">{mesesNombre[mes]} {anio}</span>
        <button className="pp-cal-nav-btn" onClick={irMesSiguiente}>›</button>
      </div>
      <div className="pp-cal-dias-header">
        {diasNombre.map(d => <div key={d} className="pp-cal-dia-nombre">{d}</div>)}
      </div>
      <div className="pp-cal-grid">
        {celdas.map((dia, i) => {
          const esHoy = dia === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear()
          const tieneTurno = dia && diasConTurno.has(dia)
          return (
            <div
              key={i}
              className={`pp-cal-celda${!dia ? ' pp-cal-celda-vacia' : ''}${esHoy ? ' pp-cal-celda-hoy' : ''}${tieneTurno ? ' pp-cal-celda-turno' : ''}`}
            >
              {dia && <span className="pp-cal-celda-num">{dia}</span>}
              {tieneTurno && <span className="pp-cal-punto" />}
            </div>
          )
        })}
      </div>
      {diasConTurno.size > 0 && (
        <div className="pp-cal-leyenda">
          <span className="pp-cal-punto-leyenda" /> Turno agendado
        </div>
      )}
    </div>
  )
}

/* ── Rutina con checks ───────────────────────────────────── */
function RutinaEjercicios({ ejercicios, onVerDetalle }) {
  const [completados, setCompletados] = useState({})

  const toggleCheck = (id, e) => {
    e.stopPropagation()
    setCompletados(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const total = ejercicios.length
  const hechos = Object.values(completados).filter(Boolean).length
  const pct = total > 0 ? Math.round((hechos / total) * 100) : 0

  return (
    <div className="pp-rutina">
      <div className="pp-rutina-header">
        <div>
          <div className="pp-seccion-titulo">Rutina de hoy</div>
          <div className="pp-rutina-progreso-txt">{hechos} de {total} ejercicios</div>
        </div>
        <div className="pp-rutina-pct">{pct}%</div>
      </div>

      <div className="pp-progreso-bar">
        <div className="pp-progreso-fill" style={{ width: `${pct}%` }} />
      </div>

      <div className="pp-rutina-lista">
        {ejercicios.map((ej, i) => {
          const nombre = ej.nombre.replace(/ — (CC|OA)$/, '')
          const hecho = completados[ej.id]
          return (
            <div
              key={ej.id}
              className={`pp-rutina-row${hecho ? ' pp-rutina-row-hecho' : ''}`}
              onClick={() => onVerDetalle(ej.id)}
            >
              <button
                className={`pp-check${hecho ? ' pp-check-on' : ''}`}
                onClick={(e) => toggleCheck(ej.id, e)}
                aria-label="Marcar como hecho"
              >
                {hecho ? '✓' : ''}
              </button>
              <div className="pp-rutina-num">{i + 1}</div>
              <div className="pp-rutina-info">
                <div className={`pp-rutina-nombre${hecho ? ' pp-rutina-nombre-hecho' : ''}`}>{nombre}</div>
                <div className="pp-rutina-cat">{ej.categoria}</div>
              </div>
              <div className="pp-rutina-params">
                {ej.series && <span>{ej.series}<small>s</small></span>}
                {ej.repeticiones && <span>{ej.repeticiones}<small>r</small></span>}
                {ej.segundos && <span>{ej.segundos}<small>"</small></span>}
              </div>
              <div className="pp-rutina-arrow">›</div>
            </div>
          )
        })}
      </div>

      {pct === 100 && (
        <div className="pp-rutina-completa">
          ¡Excelente! Completaste toda la rutina de hoy
        </div>
      )}
    </div>
  )
}

/* ── Formulario solicitar turno ──────────────────────────── */
function FormularioTurno({ paciente, onTurnoCreado }) {
  const [form, setForm] = useState({ fecha: '', hora: '', notas: '' })
  const [enviando, setEnviando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState('')

  const hoy = new Date().toISOString().split('T')[0]

  const handleChange = (campo, val) => {
    setForm(prev => ({ ...prev, [campo]: val }))
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.fecha || !form.hora) { setError('Completá fecha y hora'); return }

    setEnviando(true)
    try {
      const nuevo = await api.createTurno({
        paciente_id: paciente.id,
        fecha: form.fecha,
        hora: form.hora,
        duracion: 45,
        motivo: form.notas || 'Sesión kinesiología',
        estado: 'pendiente',
        notas: form.notas,
      })
      setExito(true)
      setForm({ fecha: '', hora: '', notas: '' })
      if (onTurnoCreado) onTurnoCreado(nuevo)
      setTimeout(() => setExito(false), 4000)
    } catch {
      setError('No se pudo enviar la solicitud. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="pp-form-turno">
      <div className="pp-seccion-titulo">Solicitar turno</div>

      {exito ? (
        <div className="pp-form-exito">
          Tu solicitud fue enviada. El kinesiólogo te confirmará el turno.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="pp-form">
          <div className="pp-form-row">
            <div className="pp-form-campo">
              <label className="pp-form-label">Fecha</label>
              <input
                type="date"
                className="pp-form-input"
                min={hoy}
                value={form.fecha}
                onChange={e => handleChange('fecha', e.target.value)}
              />
            </div>
            <div className="pp-form-campo">
              <label className="pp-form-label">Hora preferida</label>
              <input
                type="time"
                className="pp-form-input"
                value={form.hora}
                onChange={e => handleChange('hora', e.target.value)}
              />
            </div>
          </div>
          <div className="pp-form-campo">
            <label className="pp-form-label">Motivo o comentario (opcional)</label>
            <textarea
              className="pp-form-textarea"
              rows={3}
              placeholder="Ej: Control de rodilla, tengo dolor al caminar..."
              value={form.notas}
              onChange={e => handleChange('notas', e.target.value)}
            />
          </div>
          {error && <div className="pp-form-error">{error}</div>}
          <button type="submit" className="pp-btn-solicitar" disabled={enviando}>
            {enviando ? 'Enviando...' : 'Solicitar turno'}
          </button>
        </form>
      )}
    </div>
  )
}

/* ── Estudios complementarios ────────────────────────────── */
function EstudiosSection({ motivo }) {
  const [estudios, setEstudios] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (motivo?.id) {
      setLoading(true)
      api.getEstudios(motivo.id).then(setEstudios).finally(() => setLoading(false))
    }
  }, [motivo?.id])

  const handleUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('archivo', file)
    formData.append('nombre', file.name.split('.')[0])
    api.uploadEstudio(motivo.id, formData)
      .then((est) => { setEstudios([...estudios, est]); setUploading(false) })
      .catch(() => setUploading(false))
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Confirmar eliminar?')) return
    await api.deleteEstudio(id)
    setEstudios(estudios.filter(e => e.id !== id))
  }

  return (
    <div className="pp-estudios">
      <div className="pp-estudios-header">
        <span>Estudios complementarios</span>
        <label className="pp-btn-upload">
          + Agregar
          <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>
      {loading ? (
        <div className="pp-loading-sm">Cargando...</div>
      ) : estudios.length === 0 ? (
        <div className="pp-sin-estudios">Sin estudios complementarios cargados</div>
      ) : (
        <div className="pp-estudios-lista">
          {estudios.map(est => (
            <div key={est.id} className="pp-estudio-item">
              <div className="pp-estudio-info">
                <div className="pp-estudio-nombre">{est.nombre || 'Documento'}</div>
                <div className="pp-estudio-fecha">{new Date(est.created_at).toLocaleDateString('es-AR')}</div>
              </div>
              <div className="pp-estudio-acciones">
                <a href={`/api/kine/estudios/${est.id}/descargar`} className="pp-link-descarga">Descargar</a>
                <button className="pp-btn-eliminar" onClick={() => handleDelete(est.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Mis tratamientos ────────────────────────────────────── */
function MotivoCard({ motivo }) {
  const [abierto, setAbierto] = useState(false)
  const evoluciones = motivo.evoluciones || []
  const ultimaFecha = evoluciones.length > 0 ? evoluciones[0].fecha : null

  return (
    <div className={`pp-motivo${abierto ? ' pp-motivo-abierto' : ''}`}>
      <div className="pp-motivo-header" onClick={() => setAbierto(!abierto)}>
        <div className="pp-motivo-header-left">
          <div className="pp-motivo-titulo">
            {motivo.sintoma.charAt(0).toUpperCase() + motivo.sintoma.slice(1)}
          </div>
          {motivo.aparicion && (
            <div className="pp-motivo-sub">Desde {motivo.aparicion}</div>
          )}
        </div>
        <div className="pp-motivo-meta">
          <span className="pp-motivo-sesiones-badge">{evoluciones.length} sesiones</span>
          <span className="pp-motivo-chevron">{abierto ? '▾' : '▸'}</span>
        </div>
      </div>

      {abierto && (
        <div className="pp-motivo-body">
          <div className="pp-motivo-stats">
            <div className="pp-motivo-stat">
              <span className="pp-motivo-stat-val">{evoluciones.length}</span>
              <span className="pp-motivo-stat-lbl">Sesiones</span>
            </div>
            {ultimaFecha && (
              <div className="pp-motivo-stat">
                <span className="pp-motivo-stat-val">
                  {new Date(ultimaFecha + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                </span>
                <span className="pp-motivo-stat-lbl">Última sesión</span>
              </div>
            )}
          </div>
          <EstudiosSection motivo={motivo} />
        </div>
      )}
    </div>
  )
}

/* ── Overlay deuda ───────────────────────────────────────── */
function DeudaOverlay({ paciente, saldo }) {
  const mensaje = encodeURIComponent(`Hola Augusto! Soy ${paciente.nombre} ${paciente.apellido}. Acabo de realizar el pago de $${saldo} por mis sesiones de kinesiología. Alias: ${ALIAS}. Por favor confirmame cuando lo recibas. Gracias!`)
  const waUrl = `https://wa.me/${ADMIN_WA}?text=${mensaje}`

  return (
    <div className="pp-deuda-overlay">
      <div className="pp-deuda-card">
        <div className="pp-deuda-icono">🔒</div>
        <h2 className="pp-deuda-titulo">Acceso suspendido</h2>
        <p className="pp-deuda-texto">
          Tenés un saldo pendiente de <strong>${saldo}</strong> por tus sesiones de kinesiología.
        </p>
        <div className="pp-deuda-alias-box">
          <div className="pp-deuda-alias-lbl">Transferí al alias</div>
          <div className="pp-deuda-alias">{ALIAS}</div>
        </div>
        <p className="pp-deuda-sub">Una vez que realices el pago, avisanos por WhatsApp y activamos tu acceso.</p>
        <a href={waUrl} target="_blank" rel="noreferrer" className="pp-deuda-btn">
          Avisá que pagaste por WhatsApp
        </a>
      </div>
    </div>
  )
}

/* ── Portal principal ────────────────────────────────────── */
export default function PortalPaciente({ paciente }) {
  const [saldo, setSaldo] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [motivos, setMotivos] = useState([])
  const [turnos, setTurnos] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [loading, setLoading] = useState(true)
  const [seccionActiva, setSeccionActiva] = useState('inicio')

  useEffect(() => {
    if (!paciente) return
    setLoading(true)
    Promise.all([
      api.getEjerciciosGimnasio(paciente.id).then(d => setEjercicios(d?.ejercicios || [])),
      api.getSaldo(paciente.id).then(s => setSaldo(s.saldo_pendiente || 0)),
      api.getTurnos().then(ts => setTurnos(ts || [])),
      api.getMotivos(paciente.id).then(setMotivos),
    ]).finally(() => setLoading(false))
  }, [paciente?.id])

  const agregarTurno = (nuevo) => {
    setTurnos(prev => [...prev, nuevo])
  }

  if (!paciente) return (
    <div className="pp-sin-paciente">
      <div className="pp-sin-paciente-icono">🏥</div>
      <p>Tu cuenta aún no está vinculada a un paciente.<br />Consultá con tu kinesiólogo.</p>
    </div>
  )

  if (seleccionado) {
    const ej = ejercicios.find(e => e.id === seleccionado)
    if (ej) return (
      <div className="pp-wrap">
        <EjercicioDetalle ej={ej} onVolver={() => setSeleccionado(null)} />
      </div>
    )
  }

  const tieneDeuda = saldo > 0
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const proximoTurno = turnos
    .filter(t => {
      const d = new Date(t.fecha + 'T' + (t.hora || '00:00'))
      return d >= hoy && t.estado !== 'cancelado'
    })
    .sort((a, b) => new Date(a.fecha + 'T' + a.hora) - new Date(b.fecha + 'T' + b.hora))[0]

  const secciones = [
    { id: 'inicio', label: 'Inicio' },
    { id: 'rutina', label: 'Rutina' },
    { id: 'calendario', label: 'Calendario' },
    { id: 'turno', label: 'Pedir turno' },
    { id: 'tratamientos', label: 'Tratamientos' },
  ]

  return (
    <div className="pp-wrap">
      {!loading && tieneDeuda && <DeudaOverlay paciente={paciente} saldo={saldo} />}

      <div className={tieneDeuda ? 'pp-contenido-bloqueado' : ''}>

        {/* Header */}
        <div className="pp-header">
          <div className="pp-avatar">{paciente.nombre[0]}{paciente.apellido[0]}</div>
          <div className="pp-header-info">
            <div className="pp-nombre">Hola, {paciente.nombre}</div>
            <div className="pp-sub">Kinesiología Ciuró</div>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="pp-tabs">
          {secciones.map(s => (
            <button
              key={s.id}
              className={`pp-tab${seccionActiva === s.id ? ' pp-tab-activa' : ''}`}
              onClick={() => setSeccionActiva(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {loading && <div className="pp-loading">Cargando...</div>}

        {!loading && (
          <>
            {/* INICIO */}
            {seccionActiva === 'inicio' && (
              <div className="pp-seccion">
                <ProximoTurnoCard turno={proximoTurno} />

                {ejercicios.length > 0 && (
                  <div className="pp-inicio-rutina-preview">
                    <div className="pp-seccion-titulo">Rutina de hoy</div>
                    <div className="pp-rutina-preview-lista">
                      {ejercicios.slice(0, 3).map((ej, i) => (
                        <div key={ej.id} className="pp-rutina-preview-item">
                          <span className="pp-rutina-preview-num">{i + 1}</span>
                          <span className="pp-rutina-preview-nombre">{ej.nombre.replace(/ — (CC|OA)$/, '')}</span>
                        </div>
                      ))}
                    </div>
                    {ejercicios.length > 3 && (
                      <div className="pp-rutina-preview-mas">+{ejercicios.length - 3} más</div>
                    )}
                    <button className="pp-btn-ver-rutina" onClick={() => setSeccionActiva('rutina')}>
                      Ver rutina completa →
                    </button>
                  </div>
                )}

                {!proximoTurno && (
                  <div className="pp-inicio-sin-turno">
                    <div className="pp-inicio-sin-turno-txt">No tenés turnos próximos</div>
                    <button className="pp-btn-pedir-turno" onClick={() => setSeccionActiva('turno')}>
                      Pedí un turno
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* RUTINA */}
            {seccionActiva === 'rutina' && (
              <div className="pp-seccion">
                {ejercicios.length > 0
                  ? <RutinaEjercicios ejercicios={ejercicios} onVerDetalle={setSeleccionado} />
                  : <div className="pp-sin-contenido">No tenés ejercicios asignados aún.</div>
                }
              </div>
            )}

            {/* CALENDARIO */}
            {seccionActiva === 'calendario' && (
              <div className="pp-seccion">
                <CalendarioInteractivo turnos={turnos} />
                {proximoTurno && (
                  <div className="pp-cal-proximo">
                    <ProximoTurnoCard turno={proximoTurno} />
                  </div>
                )}
              </div>
            )}

            {/* PEDIR TURNO */}
            {seccionActiva === 'turno' && (
              <div className="pp-seccion">
                <FormularioTurno paciente={paciente} onTurnoCreado={agregarTurno} />
              </div>
            )}

            {/* TRATAMIENTOS */}
            {seccionActiva === 'tratamientos' && (
              <div className="pp-seccion">
                {motivos.length > 0
                  ? motivos.map(m => <MotivoCard key={m.id} motivo={m} />)
                  : <div className="pp-sin-contenido">No tenés tratamientos registrados.</div>
                }
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
