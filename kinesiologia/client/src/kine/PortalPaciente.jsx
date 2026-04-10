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
  const [data, setData] = useState(null)
  const [saldo, setSaldo] = useState(null)
  const [seleccionado, setSeleccionado] = useState(null)

  useEffect(() => {
    if (paciente) {
      api.getEjerciciosGimnasio(paciente.id).then(setData)
      api.getSaldo(paciente.id).then(s => setSaldo(s.saldo_pendiente || 0))
    }
  }, [paciente?.id])

  if (!paciente) return (
    <div className="portal-sin-paciente">
      <div className="portal-sin-paciente-icon">🏥</div>
      <p>Tu cuenta aún no está vinculada a un paciente.<br />Consultá con tu kinesiólogo.</p>
    </div>
  )

  // Si hay uno seleccionado, mostrar detalle
  if (seleccionado && data) {
    const ej = data.ejercicios.find(e => e.id === seleccionado)
    if (ej) return (
      <div className="portal-wrap">
        <EjercicioDetalle ej={ej} onVolver={() => setSeleccionado(null)} />
      </div>
    )
  }

  const loading = data === null || saldo === null
  const ejercicios = data?.ejercicios || []
  const fecha = data?.fecha
  const tieneDeuda = saldo > 0

  return (
    <div className="portal-wrap">
      {/* Overlay de deuda — se muestra encima de todo */}
      {!loading && tieneDeuda && <DeudaOverlay paciente={paciente} saldo={saldo} />}

      {/* Contenido (se difumina si hay deuda) */}
      <div className={tieneDeuda ? 'portal-contenido-bloqueado' : ''}>
        {/* Header */}
        <div className="portal-bienvenida">
          <div className="portal-bienvenida-avatar">{paciente.nombre[0]}{paciente.apellido[0]}</div>
          <div>
            <div className="portal-bienvenida-nombre">Hola, {paciente.nombre}</div>
            <div className="portal-bienvenida-sub">Kinesiología Ciuró</div>
          </div>
        </div>

        {/* Ejercicios */}
        <div className="portal-seccion-titulo">Tus ejercicios</div>

        {loading ? (
          <div className="kine-loading">Cargando...</div>
        ) : ejercicios.length === 0 ? (
          <div className="portal-sin-ejercicios">
            <div style={{ fontSize: 40, marginBottom: '0.75rem' }}>💪</div>
            <p>Tu kinesiólogo aún no asignó ejercicios.</p>
          </div>
        ) : (
          <>
            {fecha && (
              <div className="portal-fecha-sesion">
                Última sesión: <strong>{new Date(fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              </div>
            )}
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
                      {ej.segundos && <span>{ej.segundos}" </span>}
                    </div>
                    <div className="portal-ejercicio-arrow">›</div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
