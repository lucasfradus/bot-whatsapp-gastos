import { useEffect, useState } from 'react'
import { api } from './api.js'

const ALIAS = 'clic.escobar'
const ADMIN_WA = '5491144054833'

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
  return <a href={url} target="_blank" rel="noreferrer" className="kine-ej-video-link">🔍 Ver video del ejercicio</a>
}

function EjercicioDetalle({ ej, onVolver }) {
  const nombre = ej.nombre.replace(/ — (CC|OA)$/, '')
  return (
    <div className="portal-ej-detalle">
      <button className="kine-btn-back" onClick={onVolver}>← Volver</button>
      <span className="kine-ej-cat" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>{ej.categoria || 'General'}</span>
      <h2 className="portal-ej-titulo">{nombre}</h2>

      {(ej.series || ej.repeticiones || ej.segundos) && (
        <div className="portal-ej-indicacion">
          <div className="portal-ej-indicacion-titulo">Tu prescripción</div>
          <div className="portal-ej-params">
            {ej.series && <div className="portal-param"><span className="portal-param-val">{ej.series}</span><span className="portal-param-lbl">Series</span></div>}
            {ej.repeticiones && <div className="portal-param"><span className="portal-param-val">{ej.repeticiones}</span><span className="portal-param-lbl">Repeticiones</span></div>}
            {ej.segundos && <div className="portal-param"><span className="portal-param-val">{ej.segundos}"</span><span className="portal-param-lbl">Segundos</span></div>}
          </div>
        </div>
      )}

      <VideoEmbed url={ej.video_url} />
      {ej.descripcion && <p className="portal-ej-desc">{ej.descripcion}</p>}
    </div>
  )
}

function SecionesResumen({ motivo, onVerMas }) {
  const evoluciones = motivo.evoluciones || []
  const ultimaFecha = evoluciones.length > 0 ? evoluciones[0].fecha : null
  const totalSesiones = evoluciones.length

  return (
    <div className="portal-motivo-sesiones">
      <div className="portal-motivo-sesiones-header">
        <div>
          <div className="portal-motivo-sesiones-label">Total de sesiones</div>
          <div className="portal-motivo-sesiones-num">{totalSesiones}</div>
        </div>
        {ultimaFecha && (
          <div>
            <div className="portal-motivo-sesiones-label">Última sesión</div>
            <div className="portal-motivo-sesiones-fecha">
              {new Date(ultimaFecha + 'T12:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
            </div>
          </div>
        )}
      </div>
      {totalSesiones > 0 && (
        <button className="portal-motivo-btn-ver" onClick={onVerMas}>
          Ver detalle de sesiones →
        </button>
      )}
    </div>
  )
}

function EstudiosSection({ motivo, paciente, onCargarEstudio }) {
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
      .then((estudio) => {
        setEstudios([...estudios, estudio])
        setUploading(false)
      })
      .catch(() => setUploading(false))
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Confirmar eliminar?')) return
    await api.deleteEstudio(id)
    setEstudios(estudios.filter(e => e.id !== id))
  }

  return (
    <div className="portal-estudios">
      <div className="portal-estudios-header">
        <span>📋 Estudios complementarios</span>
        <label className="portal-btn-upload">
          ➕ Agregar
          <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
      </div>

      {loading ? (
        <div className="portal-loading-small">Cargando...</div>
      ) : estudios.length === 0 ? (
        <div className="portal-sin-estudios">Sin estudios complementarios</div>
      ) : (
        <div className="portal-estudios-lista">
          {estudios.map(est => (
            <div key={est.id} className="portal-estudio-item">
              <div className="portal-estudio-info">
                <div className="portal-estudio-nombre">📄 {est.nombre || 'Documento'}</div>
                <div className="portal-estudio-fecha">
                  {new Date(est.created_at).toLocaleDateString('es-AR')}
                </div>
              </div>
              <div className="portal-estudio-acciones">
                <a href={`/api/kine/estudios/${est.id}/descargar`} className="portal-link-descarga">Descargar</a>
                <button className="portal-btn-delete" onClick={() => handleDelete(est.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DeudaOverlay({ paciente, saldo }) {
  const mensaje = encodeURIComponent(`Hola Augusto! Soy ${paciente.nombre} ${paciente.apellido}. Acabo de realizar el pago de $${saldo} por mis sesiones de kinesiología. Alias: ${ALIAS}. Por favor confirmame cuando lo recibas. Gracias!`)
  const waUrl = `https://wa.me/${ADMIN_WA}?text=${mensaje}`

  return (
    <div className="portal-deuda-overlay">
      <div className="portal-deuda-card">
        <div className="portal-deuda-icon">🔒</div>
        <h2 className="portal-deuda-titulo">Acceso suspendido</h2>
        <p className="portal-deuda-texto">
          Tenés un saldo pendiente de <strong>${saldo}</strong> por tus sesiones de kinesiología.
        </p>
        <div className="portal-deuda-alias-box">
          <div className="portal-deuda-alias-label">Pagá por transferencia al alias</div>
          <div className="portal-deuda-alias">{ALIAS}</div>
        </div>
        <p className="portal-deuda-sub">Una vez que realices el pago, avisanos por WhatsApp y activamos tu acceso.</p>
        <a href={waUrl} target="_blank" rel="noreferrer" className="portal-deuda-btn">
          Avisá que pagaste
        </a>
      </div>
    </div>
  )
}

export default function PortalPaciente({ paciente }) {
  const [saldo, setSaldo] = useState(null)
  const [ejercicios, setEjercicios] = useState([])
  const [motivos, setMotivos] = useState([])
  const [turnos, setTurnos] = useState([])
  const [seleccionado, setSeleccionado] = useState(null)
  const [expandidos, setExpandidos] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!paciente) return

    setLoading(true)
    Promise.all([
      api.getEjerciciosGimnasio(paciente.id).then(d => setEjercicios(d?.ejercicios || [])),
      api.getSaldo(paciente.id).then(s => setSaldo(s.saldo_pendiente || 0)),
      api.getTurnos().then(ts => setTurnos(ts)),
      api.getMotivos(paciente.id).then(setMotivos),
    ]).finally(() => setLoading(false))
  }, [paciente?.id])

  if (!paciente) return (
    <div className="portal-sin-paciente">
      <div className="portal-sin-paciente-icon">🏥</div>
      <p>Tu cuenta aún no está vinculada a un paciente.<br />Consultá con tu kinesiólogo.</p>
    </div>
  )

  if (seleccionado && ejercicios.length > 0) {
    const ej = ejercicios.find(e => e.id === seleccionado)
    if (ej) return (
      <div className="portal-wrap">
        <EjercicioDetalle ej={ej} onVolver={() => setSeleccionado(null)} />
      </div>
    )
  }

  const tieneDeuda = saldo > 0
  const proximoTurno = turnos.find(t => new Date(t.fecha) >= new Date())

  const toggleMotivo = (id) => {
    setExpandidos(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="portal-wrap">
      {!loading && tieneDeuda && <DeudaOverlay paciente={paciente} saldo={saldo} />}

      <div className={tieneDeuda ? 'portal-contenido-bloqueado' : ''}>
        {/* Header */}
        <div className="portal-bienvenida">
          <div className="portal-bienvenida-avatar">{paciente.nombre[0]}{paciente.apellido[0]}</div>
          <div>
            <div className="portal-bienvenida-nombre">Hola, {paciente.nombre}</div>
            <div className="portal-bienvenida-sub">Kinesiología Ciuró</div>
          </div>
        </div>

        {/* Próximo Turno (destacado) */}
        {proximoTurno && (
          <div className="portal-proximo-turno">
            <div className="portal-proximo-turno-icon">📅</div>
            <div className="portal-proximo-turno-info">
              <div className="portal-proximo-turno-label">Tu próximo turno</div>
              <div className="portal-proximo-turno-fecha">
                {new Date(proximoTurno.fecha + 'T' + proximoTurno.hora).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div className="portal-proximo-turno-hora">{proximoTurno.hora}</div>
            </div>
          </div>
        )}

        {/* Ejercicios a hacer */}
        {ejercicios.length > 0 && (
          <>
            <div className="portal-seccion-titulo">💪 Qué te toca hacer hoy</div>
            <div className="portal-ejercicios-lista">
              {ejercicios.map((ej, i) => {
                const nombre = ej.nombre.replace(/ — (CC|OA)$/, '')
                return (
                  <div key={ej.id} className="portal-ejercicio-row" onClick={() => setSeleccionado(ej.id)}>
                    <div className="portal-ejercicio-num">{i + 1}</div>
                    <div className="portal-ejercicio-info">
                      <div className="portal-ejercicio-nombre">{nombre}</div>
                      <div className="portal-ejercicio-cat">{ej.categoria}</div>
                    </div>
                    <div className="portal-ejercicio-params">
                      {ej.series && <span>{ej.series} <small>series</small></span>}
                      {ej.repeticiones && <span>{ej.repeticiones} <small>reps</small></span>}
                      {ej.segundos && <span>{ej.segundos}"</span>}
                    </div>
                    <div className="portal-ejercicio-arrow">›</div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* Mis lesiones/motivos */}
        {motivos.length > 0 && (
          <>
            <div className="portal-seccion-titulo">📋 Tus tratamientos</div>
            <div className="portal-motivos-lista">
              {motivos.map(motivo => (
                <div key={motivo.id} className="portal-motivo-card">
                  <div
                    className="portal-motivo-header"
                    onClick={() => toggleMotivo(motivo.id)}
                  >
                    <div className="portal-motivo-header-left">
                      <div className="portal-motivo-titulo">
                        {motivo.sintoma.charAt(0).toUpperCase() + motivo.sintoma.slice(1)}
                      </div>
                      {motivo.aparicion && (
                        <div className="portal-motivo-sub">Desde {motivo.aparicion}</div>
                      )}
                    </div>
                    <div className="portal-motivo-expand">
                      {expandidos[motivo.id] ? '▼' : '▶'}
                    </div>
                  </div>

                  {expandidos[motivo.id] && (
                    <div className="portal-motivo-content">
                      <SecionesResumen
                        motivo={motivo}
                        onVerMas={() => {
                          /* Aquí podría expandir más detalles de sesiones */
                        }}
                      />
                      <EstudiosSection motivo={motivo} paciente={paciente} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {loading && (
          <div className="kine-loading">Cargando información...</div>
        )}
      </div>
    </div>
  )
}
