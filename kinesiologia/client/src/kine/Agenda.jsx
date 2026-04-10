import { useEffect, useState } from 'react'
import { api } from './api.js'
import Modal from './Modal.jsx'

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const HORAS = ['07:00','07:30','08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00']

const EMPTY = { paciente_id: '', fecha: '', hora: '09:00', duracion: 60, motivo: '', estado: 'pendiente', notas: '' }

function pad(n) { return String(n).padStart(2, '0') }

export default function Agenda() {
  const [hoy] = useState(new Date())
  const [mesActual, setMesActual] = useState(new Date())
  const [turnos, setTurnos] = useState([])
  const [pacientes, setPacientes] = useState([])
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)

  const mesStr = `${mesActual.getFullYear()}-${pad(mesActual.getMonth() + 1)}`

  useEffect(() => {
    api.getTurnos(mesStr).then(setTurnos)
    api.getPacientes().then(setPacientes)
  }, [mesStr])

  function diasDelMes() {
    const anio = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const primerDia = new Date(anio, mes, 1).getDay()
    const totalDias = new Date(anio, mes + 1, 0).getDate()
    const dias = []
    for (let i = 0; i < primerDia; i++) dias.push(null)
    for (let d = 1; d <= totalDias; d++) dias.push(d)
    return dias
  }

  function turnosDelDia(dia) {
    if (!dia) return []
    const fecha = `${mesActual.getFullYear()}-${pad(mesActual.getMonth() + 1)}-${pad(dia)}`
    return turnos.filter(t => t.fecha === fecha).sort((a, b) => a.hora.localeCompare(b.hora))
  }

  function esTodayCheck(dia) {
    return dia && mesActual.getFullYear() === hoy.getFullYear() && mesActual.getMonth() === hoy.getMonth() && dia === hoy.getDate()
  }

  function abrirNuevo(dia) {
    const fecha = dia ? `${mesActual.getFullYear()}-${pad(mesActual.getMonth() + 1)}-${pad(dia)}` : ''
    setForm({ ...EMPTY, fecha })
    setEditId(null)
    setModal(true)
  }

  function abrirEditar(t) {
    setForm({ paciente_id: t.paciente_id || '', fecha: t.fecha, hora: t.hora, duracion: t.duracion, motivo: t.motivo || '', estado: t.estado, notas: t.notas || '' })
    setEditId(t.id)
    setModal(true)
  }

  async function guardar(e) {
    e.preventDefault()
    if (editId) await api.updateTurno(editId, form)
    else await api.createTurno(form)
    setModal(false)
    api.getTurnos(mesStr).then(setTurnos)
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar turno?')) return
    await api.deleteTurno(id)
    api.getTurnos(mesStr).then(setTurnos)
  }

  async function cambiarEstado(id, estado) {
    await api.updateTurno(id, { ...turnos.find(t => t.id === id), estado })
    api.getTurnos(mesStr).then(setTurnos)
  }

  const diasGrid = diasDelMes()
  const turnosDiaSelec = diaSeleccionado ? turnosDelDia(diaSeleccionado) : []

  return (
    <div className="kine-page">
      <div className="kine-page-header">
        <h1 className="kine-page-title">Agenda</h1>
        <button className="kine-btn-primary" onClick={() => abrirNuevo(diaSeleccionado)}>+ Nuevo turno</button>
      </div>

      <div className="agenda-layout">
        {/* Calendario */}
        <div className="agenda-cal">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => setMesActual(m => new Date(m.getFullYear(), m.getMonth() - 1))}>‹</button>
            <span className="cal-mes-titulo">{MESES[mesActual.getMonth()]} {mesActual.getFullYear()}</span>
            <button className="cal-nav-btn" onClick={() => setMesActual(m => new Date(m.getFullYear(), m.getMonth() + 1))}>›</button>
          </div>

          <div className="cal-grid-header">
            {DIAS.map(d => <div key={d} className="cal-dia-nombre">{d}</div>)}
          </div>

          <div className="cal-grid">
            {diasGrid.map((dia, i) => {
              const tDia = turnosDelDia(dia)
              const isToday = esTodayCheck(dia)
              const isSelected = diaSeleccionado === dia
              return (
                <div
                  key={i}
                  className={`cal-celda ${dia ? 'activa' : ''} ${isToday ? 'hoy' : ''} ${isSelected ? 'seleccionada' : ''}`}
                  onClick={() => dia && setDiaSeleccionado(dia)}
                >
                  {dia && (
                    <>
                      <span className="cal-num">{dia}</span>
                      {tDia.length > 0 && (
                        <div className="cal-dots">
                          {tDia.slice(0, 3).map((t, j) => (
                            <span key={j} className={`cal-dot estado-${t.estado}`} />
                          ))}
                          {tDia.length > 3 && <span className="cal-dot-mas">+{tDia.length - 3}</span>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Panel lateral del día */}
        <div className="agenda-panel">
          {!diaSeleccionado
            ? <div className="kine-empty">Seleccioná un día para ver los turnos</div>
            : (
              <>
                <div className="agenda-panel-header">
                  <div className="agenda-panel-titulo">
                    {new Date(mesActual.getFullYear(), mesActual.getMonth(), diaSeleccionado).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <button className="kine-btn-sm" onClick={() => abrirNuevo(diaSeleccionado)}>+</button>
                </div>

                {turnosDiaSelec.length === 0
                  ? <div className="kine-empty-sm">Sin turnos este día</div>
                  : (
                    <div className="agenda-turnos">
                      {turnosDiaSelec.map(t => (
                        <div key={t.id} className={`agenda-turno estado-borde-${t.estado}`}>
                          <div className="agenda-turno-hora">{t.hora}</div>
                          <div className="agenda-turno-info">
                            <div className="agenda-turno-pac">{t.nombre} {t.apellido}</div>
                            {t.motivo && <div className="agenda-turno-motivo">{t.motivo}</div>}
                            {t.duracion && <div className="agenda-turno-dur">{t.duracion} min</div>}
                          </div>
                          <div className="agenda-turno-acciones">
                            <span className={`kine-estado ${t.estado}`}>{t.estado}</span>
                            <div className="agenda-btns">
                              {t.estado === 'pendiente' && <button className="kine-btn-icon-sm" title="Confirmar" onClick={() => cambiarEstado(t.id, 'confirmado')}>✓</button>}
                              {t.estado === 'pendiente' && <button className="kine-btn-icon-sm danger" title="Cancelar" onClick={() => cambiarEstado(t.id, 'cancelado')}>✗</button>}
                              <button className="kine-btn-icon-sm" onClick={() => abrirEditar(t)}>✎</button>
                              <button className="kine-btn-icon-sm danger" onClick={() => eliminar(t.id)}>🗑</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </>
            )
          }
        </div>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} titulo={editId ? 'Editar turno' : 'Nuevo turno'}>
        <form className="kine-form" onSubmit={guardar}>
          <label>Paciente *
            <select required value={form.paciente_id} onChange={e => setForm(f => ({ ...f, paciente_id: e.target.value }))}>
              <option value="">Seleccioná...</option>
              {pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>)}
            </select>
          </label>
          <div className="kine-form-row">
            <label>Fecha *<input type="date" required value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} /></label>
            <label>Hora *
              <select required value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}>
                {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>
            <label>Duración (min)<input type="number" min="15" step="15" value={form.duracion} onChange={e => setForm(f => ({ ...f, duracion: e.target.value }))} /></label>
          </div>
          <label>Motivo<input value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} placeholder="Ej: Control, primera consulta..." /></label>
          <label>Estado
            <select value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
              <option value="realizado">Realizado</option>
            </select>
          </label>
          <label>Notas<textarea rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></label>
          <div className="kine-form-footer">
            <button type="button" className="kine-btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="kine-btn-primary">{editId ? 'Guardar' : 'Crear turno'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
