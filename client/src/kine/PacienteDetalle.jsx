import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from './api.js'
import Modal from './Modal.jsx'

const MOTIVO_EMPTY = { sintoma: '', aparicion: '', momento_dia: '', movimientos: '', afloja_dia: false, monto_sesion: '', estado: 'activo' }
const EVOL_EMPTY = { fecha: new Date().toISOString().slice(0, 10), notas: '', dolor: '', tecnicas: '', monto_cobrado: '', pagado: false, tecnicas_sesion: [], ejercicios_sesion: [] }

const TECNICAS_OPCIONES = [
  'Puncion Seca',
  'MEP',
  'Masoterapia',
  'Movilidad',
  'Gun',
]

function SaldoChip({ saldo }) {
  if (!saldo) return null
  const pendiente = saldo.saldo_pendiente || 0
  return (
    <div className={`saldo-chip ${pendiente > 0 ? 'deuda' : 'ok'}`}>
      {pendiente > 0 ? `Debe $${pendiente.toLocaleString('es-AR')}` : 'Sin deuda'}
    </div>
  )
}

function MotivoCard({ motivo, onUpdated }) {
  const [open, setOpen] = useState(false)
  const [evoluciones, setEvoluciones] = useState([])
  const [estudios, setEstudios] = useState([])
  const [loadingEvol, setLoadingEvol] = useState(false)
  const [modalEvol, setModalEvol] = useState(false)
  const [formEvol, setFormEvol] = useState(EVOL_EMPTY)
  const [editEvolId, setEditEvolId] = useState(null)
  const [modalEstudio, setModalEstudio] = useState(false)
  const [archivoEstudio, setArchivoEstudio] = useState(null)
  const [nombreEstudio, setNombreEstudio] = useState('')
  const [modalEditMotivo, setModalEditMotivo] = useState(false)
  const [formMotivo, setFormMotivo] = useState({ ...motivo, afloja_dia: !!motivo.afloja_dia })
  const [ejercicios, setEjercicios] = useState([])
  const [busquedaEj, setBusquedaEj] = useState('')

  useEffect(() => {
    if (open) {
      cargarDetalle()
      if (ejercicios.length === 0) {
        api.getEjercicios().then(setEjercicios).catch(() => {})
      }
    }
  }, [open])

  useEffect(() => {
    if (modalEvol && ejercicios.length === 0) {
      api.getEjercicios().then(setEjercicios).catch(() => {})
    }
  }, [modalEvol])

  async function cargarDetalle() {
    setLoadingEvol(true)
    try {
      const [evols, ests, ejs] = await Promise.all([
        api.getEvoluciones(motivo.id),
        api.getEstudios(motivo.id),
        api.getEjercicios(),
      ])
      setEvoluciones(evols)
      setEstudios(ests)
      setEjercicios(ejs)
    } finally { setLoadingEvol(false) }
  }

  async function guardarEvol(e) {
    e.preventDefault()
    const data = {
      ...formEvol,
      tecnicas_sesion: JSON.stringify(formEvol.tecnicas_sesion || []),
      ejercicios_sesion: JSON.stringify(formEvol.ejercicios_sesion || []),
      pagado: formEvol.pagado ? 1 : 0
    }
    if (editEvolId) await api.updateEvolucion(editEvolId, data)
    else await api.createEvolucion(motivo.id, data)
    setModalEvol(false)
    setEvoluciones(await api.getEvoluciones(motivo.id))
    onUpdated()
  }

  function abrirNuevaEvol() {
    setFormEvol({ ...EVOL_EMPTY, tecnicas_sesion: [], ejercicios_sesion: [], monto_cobrado: motivo.monto_sesion || '' })
    setEditEvolId(null)
    setBusquedaEj('')
    setModalEvol(true)
  }

  function abrirEditarEvol(ev) {
    setFormEvol({
      fecha: ev.fecha,
      notas: ev.notas || '',
      dolor: ev.dolor ?? '',
      tecnicas: ev.tecnicas || '',
      monto_cobrado: ev.monto_cobrado || '',
      pagado: !!ev.pagado,
      tecnicas_sesion: ev.tecnicas_sesion ? JSON.parse(ev.tecnicas_sesion) : [],
      ejercicios_sesion: ev.ejercicios_sesion ? JSON.parse(ev.ejercicios_sesion) : []
    })
    setEditEvolId(ev.id)
    setModalEvol(true)
  }

  async function eliminarEvol(id) {
    if (!confirm('¿Eliminar esta sesión?')) return
    await api.deleteEvolucion(id)
    setEvoluciones(await api.getEvoluciones(motivo.id))
    onUpdated()
  }

  async function subirEstudio(e) {
    e.preventDefault()
    if (!archivoEstudio) return
    const fd = new FormData()
    fd.append('archivo', archivoEstudio)
    fd.append('nombre', nombreEstudio || archivoEstudio.name)
    fd.append('tipo', archivoEstudio.type.startsWith('image') ? 'imagen' : 'documento')
    await api.uploadEstudio(motivo.id, fd)
    setModalEstudio(false)
    setArchivoEstudio(null)
    setNombreEstudio('')
    setEstudios(await api.getEstudios(motivo.id))
  }

  async function eliminarEstudio(id) {
    if (!confirm('¿Eliminar estudio?')) return
    await api.deleteEstudio(id)
    setEstudios(await api.getEstudios(motivo.id))
  }

  async function guardarMotivo(e) {
    e.preventDefault()
    await api.updateMotivo(motivo.id, { ...formMotivo, afloja_dia: formMotivo.afloja_dia ? 1 : 0 })
    setModalEditMotivo(false)
    onUpdated()
  }

  async function eliminarMotivo() {
    if (!confirm('¿Eliminar este motivo y toda su historia?')) return
    await api.deleteMotivo(motivo.id)
    onUpdated()
  }

  const chartData = [...evoluciones].reverse().filter(e => e.dolor != null).map(e => ({ fecha: e.fecha, dolor: e.dolor }))

  return (
    <div className={`motivo-card ${open ? 'open' : ''}`}>
      <div className="motivo-card-header" onClick={() => setOpen(o => !o)}>
        <div className="motivo-card-left">
          <span className={`motivo-estado-dot estado-${motivo.estado}`} />
          <div>
            <div className="motivo-sintoma">{motivo.sintoma}</div>
            <div className="motivo-meta">
              {motivo.total_evoluciones} sesión{motivo.total_evoluciones !== 1 ? 'es' : ''}
              {motivo.monto_sesion > 0 && ` · $${motivo.monto_sesion.toLocaleString('es-AR')}/sesión`}
              {motivo.saldo_pendiente > 0 && <span className="motivo-deuda"> · Debe ${motivo.saldo_pendiente.toLocaleString('es-AR')}</span>}
            </div>
          </div>
        </div>
        <div className="motivo-card-acciones" onClick={e => e.stopPropagation()}>
          <button className="kine-btn-icon-sm" onClick={() => { setFormMotivo({ ...motivo, afloja_dia: !!motivo.afloja_dia }); setModalEditMotivo(true) }}>✎</button>
          <button className="kine-btn-icon-sm danger" onClick={eliminarMotivo}>✕</button>
          <span className="motivo-chevron">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="motivo-body">
          <div className="motivo-ficha">
            {motivo.aparicion && <div className="motivo-ficha-item"><span>Aparición</span>{motivo.aparicion}</div>}
            {motivo.momento_dia && <div className="motivo-ficha-item"><span>Momento del día</span>{motivo.momento_dia}</div>}
            {motivo.movimientos && <div className="motivo-ficha-item"><span>Movimientos que duelen</span>{motivo.movimientos}</div>}
            <div className="motivo-ficha-item"><span>Afloja con el día</span>{motivo.afloja_dia ? 'Sí' : 'No'}</div>
          </div>

          {/* Estudios */}
          <div className="motivo-seccion">
            <div className="motivo-seccion-header">
              <span>Estudios</span>
              <button className="kine-btn-sm" onClick={() => setModalEstudio(true)}>+ Subir</button>
            </div>
            {loadingEvol
              ? null
              : estudios.length === 0
                ? <div className="kine-empty-sm">Sin estudios cargados</div>
                : (
                  <div className="estudios-grid">
                    {estudios.map(est => (
                      <div key={est.id} className="estudio-item">
                        {est.tipo === 'imagen'
                          ? <img src={`/uploads/${est.archivo}`} alt={est.nombre} className="estudio-img" onClick={() => window.open(`/uploads/${est.archivo}`)} />
                          : <a href={`/api/kine/estudios/${est.id}/descargar`} className="estudio-doc">📄 {est.nombre}</a>
                        }
                        <div className="estudio-nombre">{est.nombre}</div>
                        <button className="kine-btn-icon-sm danger estudio-del" onClick={() => eliminarEstudio(est.id)}>✕</button>
                      </div>
                    ))}
                  </div>
                )
            }
          </div>

          {/* Evolución */}
          <div className="motivo-seccion">
            <div className="motivo-seccion-header">
              <span>Evolución ({motivo.total_evoluciones} sesiones)</span>
              <button className="kine-btn-sm" onClick={abrirNuevaEvol}>+ Nueva sesión</button>
            </div>

            {chartData.length > 1 && (
              <div className="evol-chart">
                <ResponsiveContainer width="100%" height={120}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="dolor" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {loadingEvol
              ? <div className="kine-loading">Cargando...</div>
              : evoluciones.length === 0
                ? <div className="kine-empty-sm">Sin sesiones registradas</div>
                : (
                  <div className="evol-lista">
                    {evoluciones.map(ev => {
                      const tecnicas = ev.tecnicas_sesion ? JSON.parse(ev.tecnicas_sesion) : []
                      const ejerciciosIds = ev.ejercicios_sesion ? JSON.parse(ev.ejercicios_sesion) : []
                      const ejerciciosNombres = ejerciciosIds.map(id => {
                        const ej = ejercicios.find(e => e.id === id)
                        return ej ? ej.nombre : null
                      }).filter(Boolean)
                      return (
                        <div key={ev.id} className="evol-item">
                          <div className="evol-fecha">{new Date(ev.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                          <div className="evol-contenido">
                            {ev.dolor != null && ev.dolor !== '' && <span className="evol-dolor">Dolor: {ev.dolor}/10</span>}
                            {tecnicas.length > 0 && (
                              <div className="evol-tags">
                                {tecnicas.map(t => <span key={t} className="evol-tag tecnica">{t}</span>)}
                              </div>
                            )}
                            {ejerciciosNombres.length > 0 && (
                              <div className="evol-tags">
                                {ejerciciosNombres.map(e => <span key={e} className="evol-tag ejercicio">{e}</span>)}
                              </div>
                            )}
                            {ev.notas && <div className="evol-notas">{ev.notas}</div>}
                          </div>
                          <div className="evol-pago">
                            {ev.monto_cobrado > 0 && (
                              <span className={`evol-monto ${ev.pagado ? 'pagado' : 'pendiente'}`}>
                                ${Number(ev.monto_cobrado).toLocaleString('es-AR')} {ev.pagado ? '✓' : '⏳'}
                              </span>
                            )}
                          </div>
                          <div className="evol-btns">
                            <button className="kine-btn-icon-sm" onClick={() => abrirEditarEvol(ev)}>✎</button>
                            <button className="kine-btn-icon-sm danger" onClick={() => eliminarEvol(ev.id)}>✕</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
            }
          </div>
        </div>
      )}

      {/* Modal editar motivo */}
      <Modal open={modalEditMotivo} onClose={() => setModalEditMotivo(false)} titulo="Editar motivo de consulta">
        <form className="kine-form" onSubmit={guardarMotivo}>
          <label>Síntoma *<input required value={formMotivo.sintoma} onChange={e => setFormMotivo(f => ({ ...f, sintoma: e.target.value }))} /></label>
          <label>Aparición del síntoma<input value={formMotivo.aparicion || ''} onChange={e => setFormMotivo(f => ({ ...f, aparicion: e.target.value }))} placeholder="¿Cuándo empezó?" /></label>
          <label>Momento del día que duele<input value={formMotivo.momento_dia || ''} onChange={e => setFormMotivo(f => ({ ...f, momento_dia: e.target.value }))} placeholder="Ej: Por la mañana, al levantarse..." /></label>
          <label>Movimientos que duelen<textarea rows={2} value={formMotivo.movimientos || ''} onChange={e => setFormMotivo(f => ({ ...f, movimientos: e.target.value }))} /></label>
          <div className="kine-form-row">
            <label className="kine-form-check">
              <input type="checkbox" checked={!!formMotivo.afloja_dia} onChange={e => setFormMotivo(f => ({ ...f, afloja_dia: e.target.checked }))} />
              Afloja con el paso del día
            </label>
            <label>Monto por sesión ($)<input type="number" min="0" step="100" value={formMotivo.monto_sesion || ''} onChange={e => setFormMotivo(f => ({ ...f, monto_sesion: e.target.value }))} /></label>
          </div>
          <label>Estado
            <select value={formMotivo.estado} onChange={e => setFormMotivo(f => ({ ...f, estado: e.target.value }))}>
              <option value="activo">Activo</option>
              <option value="resuelto">Resuelto</option>
              <option value="derivado">Derivado</option>
            </select>
          </label>
          <div className="kine-form-footer">
            <button type="button" className="kine-btn-secondary" onClick={() => setModalEditMotivo(false)}>Cancelar</button>
            <button type="submit" className="kine-btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      {/* Modal nueva/editar evolución */}
      <Modal open={modalEvol} onClose={() => setModalEvol(false)} titulo={editEvolId ? 'Editar sesión' : 'Nueva sesión'}>
        <form className="kine-form" onSubmit={guardarEvol}>
          <div className="kine-form-row">
            <label>Fecha *<input type="date" required value={formEvol.fecha} onChange={e => setFormEvol(f => ({ ...f, fecha: e.target.value }))} /></label>
            <label>Dolor (0-10)<input type="number" min="0" max="10" value={formEvol.dolor} onChange={e => setFormEvol(f => ({ ...f, dolor: e.target.value }))} placeholder="0-10" /></label>
          </div>
          
          <label>Técnicas de la sesión
            <div className="kine-checkbox-group">
              {TECNICAS_OPCIONES.map(tec => (
                <label key={tec} className="kine-checkbox-item">
                  <input
                    type="checkbox"
                    checked={formEvol.tecnicas_sesion?.includes(tec)}
                    onChange={e => {
                      const current = formEvol.tecnicas_sesion || []
                      const updated = e.target.checked
                        ? [...current, tec]
                        : current.filter(t => t !== tec)
                      setFormEvol(f => ({ ...f, tecnicas_sesion: updated }))
                    }}
                  />
                  {tec}
                </label>
              ))}
            </div>
          </label>

          {/* Ejercicios de gimnasio */}
          <div className="kine-ej-selector">
            <div className="kine-ej-selector-titulo">Ejercicios de gimnasio</div>

            {/* Tags de seleccionados */}
            {(formEvol.ejercicios_sesion?.length > 0) && (
              <div className="kine-ej-tags-sel">
                {formEvol.ejercicios_sesion.map(eid => {
                  const ej = ejercicios.find(e => e.id === eid)
                  return ej ? (
                    <span key={eid} className="kine-ej-tag-sel">
                      {ej.nombre}
                      <button type="button" onClick={() => setFormEvol(f => ({ ...f, ejercicios_sesion: f.ejercicios_sesion.filter(i => i !== eid) }))}>×</button>
                    </span>
                  ) : null
                })}
              </div>
            )}

            {/* Buscador */}
            <input
              className="kine-ej-buscar"
              placeholder="🔍 Buscar ejercicio..."
              value={busquedaEj}
              onChange={e => setBusquedaEj(e.target.value)}
            />

            {/* Lista filtrada */}
            <div className="kine-ej-lista-scroll">
              {(() => {
                const term = busquedaEj.toLowerCase()
                const filtrados = ejercicios.filter(ej =>
                  ej.nombre.toLowerCase().includes(term) ||
                  (ej.categoria || '').toLowerCase().includes(term)
                )
                if (filtrados.length === 0) return <div className="kine-empty-sm">Sin resultados</div>

                // Agrupar por categoría
                const cats = [...new Set(filtrados.map(e => e.categoria || 'General'))]
                return cats.map(cat => (
                  <div key={cat}>
                    <div className="kine-ej-cat-header">{cat}</div>
                    {filtrados.filter(e => (e.categoria || 'General') === cat).map(ej => {
                      const sel = formEvol.ejercicios_sesion?.includes(ej.id)
                      return (
                        <label key={ej.id} className={`kine-ej-opcion ${sel ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={!!sel}
                            onChange={e => {
                              const cur = formEvol.ejercicios_sesion || []
                              setFormEvol(f => ({ ...f, ejercicios_sesion: e.target.checked ? [...cur, ej.id] : cur.filter(i => i !== ej.id) }))
                            }}
                          />
                          <div className="kine-ej-opcion-info">
                            <div className="kine-ej-opcion-nombre">{ej.nombre}</div>
                            {ej.descripcion && <div className="kine-ej-opcion-desc">{ej.descripcion}</div>}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ))
              })()}
            </div>
          </div>

          <label>Notas de la sesión<textarea rows={3} value={formEvol.notas} onChange={e => setFormEvol(f => ({ ...f, notas: e.target.value }))} /></label>
          <div className="kine-form-row">
            <label>Monto cobrado ($)<input type="number" min="0" step="100" value={formEvol.monto_cobrado} onChange={e => setFormEvol(f => ({ ...f, monto_cobrado: e.target.value }))} /></label>
            <label className="kine-form-check" style={{ justifyContent: 'flex-end', paddingTop: '1.5rem' }}>
              <input type="checkbox" checked={!!formEvol.pagado} onChange={e => setFormEvol(f => ({ ...f, pagado: e.target.checked }))} />
              Cobrado
            </label>
          </div>
          <div className="kine-form-footer">
            <button type="button" className="kine-btn-secondary" onClick={() => setModalEvol(false)}>Cancelar</button>
            <button type="submit" className="kine-btn-primary">{editEvolId ? 'Guardar' : 'Registrar sesión'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal subir estudio */}
      <Modal open={modalEstudio} onClose={() => setModalEstudio(false)} titulo="Subir estudio">
        <form className="kine-form" onSubmit={subirEstudio}>
          <label>Archivo *<input type="file" required onChange={e => setArchivoEstudio(e.target.files[0])} accept="image/*,.pdf,.doc,.docx" /></label>
          <label>Nombre (opcional)<input value={nombreEstudio} onChange={e => setNombreEstudio(e.target.value)} placeholder="Ej: Radiografía rodilla derecha" /></label>
          <div className="kine-form-footer">
            <button type="button" className="kine-btn-secondary" onClick={() => setModalEstudio(false)}>Cancelar</button>
            <button type="submit" className="kine-btn-primary">Subir</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

export default function PacienteDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [paciente, setPaciente] = useState(null)
  const [motivos, setMotivos] = useState([])
  const [saldo, setSaldo] = useState(null)
  const [modalMotivo, setModalMotivo] = useState(false)
  const [formMotivo, setFormMotivo] = useState(MOTIVO_EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setLoading(true)
    try {
      const [pac, movs, sld] = await Promise.all([
        api.getPaciente(id),
        api.getMotivos(id),
        api.getSaldo(id),
      ])
      setPaciente(pac)
      setMotivos(movs)
      setSaldo(sld)
    } finally { setLoading(false) }
  }

  async function crearMotivo(e) {
    e.preventDefault()
    await api.createMotivo(id, { ...formMotivo, afloja_dia: formMotivo.afloja_dia ? 1 : 0 })
    setModalMotivo(false)
    cargar()
  }

  if (loading) return <div className="kine-loading">Cargando...</div>
  if (!paciente) return <div className="kine-empty">Paciente no encontrado</div>

  return (
    <div className="kine-page">
      <div className="kine-page-header">
        <div className="paciente-header-left">
          <button className="kine-btn-back" onClick={() => navigate('/kine/pacientes')}>← Volver</button>
          <div className="paciente-header-avatar">{paciente.nombre[0]}{paciente.apellido[0]}</div>
          <div>
            <h1 className="kine-page-title" style={{ marginBottom: 0 }}>{paciente.nombre} {paciente.apellido}</h1>
            <div className="paciente-header-meta">
              {paciente.edad && <span>{paciente.edad} años</span>}
              {paciente.celular && <span>{paciente.celular}</span>}
              {paciente.email && <span>{paciente.email}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {saldo && <SaldoChip saldo={saldo} />}
          <button className="kine-btn-primary" onClick={() => { setFormMotivo(MOTIVO_EMPTY); setModalMotivo(true) }}>+ Motivo de consulta</button>
        </div>
      </div>

      {saldo && saldo.total_sesiones > 0 && (
        <div className="saldo-resumen">
          <div className="saldo-item"><span>Sesiones</span><strong>{saldo.total_sesiones}</strong></div>
          <div className="saldo-item"><span>Total cobrado</span><strong>${Number(saldo.total_cobrado).toLocaleString('es-AR')}</strong></div>
          <div className="saldo-item"><span>Pagado</span><strong>${Number(saldo.total_pagado).toLocaleString('es-AR')}</strong></div>
          <div className={`saldo-item ${saldo.saldo_pendiente > 0 ? 'deuda' : ''}`}>
            <span>Saldo pendiente</span>
            <strong>${Number(saldo.saldo_pendiente).toLocaleString('es-AR')}</strong>
          </div>
        </div>
      )}

      {motivos.length === 0
        ? (
          <div className="kine-empty" style={{ marginTop: '2rem' }}>
            <p>No hay motivos de consulta registrados</p>
            <button className="kine-btn-primary" style={{ marginTop: '1rem' }} onClick={() => { setFormMotivo(MOTIVO_EMPTY); setModalMotivo(true) }}>
              + Agregar motivo de consulta
            </button>
          </div>
        )
        : (
          <div className="motivos-lista">
            {motivos.map(m => (
              <MotivoCard key={m.id} motivo={m} onUpdated={cargar} />
            ))}
          </div>
        )
      }

      <Modal open={modalMotivo} onClose={() => setModalMotivo(false)} titulo="Nuevo motivo de consulta">
        <form className="kine-form" onSubmit={crearMotivo}>
          <label>Síntoma *<input required value={formMotivo.sintoma} onChange={e => setFormMotivo(f => ({ ...f, sintoma: e.target.value }))} placeholder="Ej: Dolor lumbar, gonalgia, cervicalgia..." /></label>
          <label>Aparición del síntoma<input value={formMotivo.aparicion} onChange={e => setFormMotivo(f => ({ ...f, aparicion: e.target.value }))} placeholder="¿Cuándo empezó?" /></label>
          <label>Momento del día que duele<input value={formMotivo.momento_dia} onChange={e => setFormMotivo(f => ({ ...f, momento_dia: e.target.value }))} placeholder="Ej: Al levantarse, de noche..." /></label>
          <label>Movimientos que duelen<textarea rows={2} value={formMotivo.movimientos} onChange={e => setFormMotivo(f => ({ ...f, movimientos: e.target.value }))} /></label>
          <div className="kine-form-row">
            <label className="kine-form-check">
              <input type="checkbox" checked={formMotivo.afloja_dia} onChange={e => setFormMotivo(f => ({ ...f, afloja_dia: e.target.checked }))} />
              Afloja con el paso del día
            </label>
            <label>Monto por sesión ($)<input type="number" min="0" step="100" value={formMotivo.monto_sesion} onChange={e => setFormMotivo(f => ({ ...f, monto_sesion: e.target.value }))} /></label>
          </div>
          <div className="kine-form-footer">
            <button type="button" className="kine-btn-secondary" onClick={() => setModalMotivo(false)}>Cancelar</button>
            <button type="submit" className="kine-btn-primary">Crear</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
