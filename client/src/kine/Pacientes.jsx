import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './api.js'
import Modal from './Modal.jsx'

const EMPTY = { nombre: '', apellido: '', edad: '', email: '', celular: '', dni: '' }

export default function Pacientes() {
  const [pacientes, setPacientes] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [accesoCreado, setAccesoCreado] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    try { setPacientes(await api.getPacientes()) } finally { setLoading(false) }
  }

  function abrirNuevo() { setForm(EMPTY); setEditId(null); setAccesoCreado(null); setModal(true) }

  function abrirEditar(p, e) {
    e.stopPropagation()
    setForm({ nombre: p.nombre, apellido: p.apellido, edad: p.edad || '', email: p.email || '', celular: p.celular || '', dni: p.dni || '' })
    setEditId(p.id)
    setAccesoCreado(null)
    setModal(true)
  }

  async function guardar(e) {
    e.preventDefault()
    if (editId) {
      await api.updatePaciente(editId, form)
      setModal(false)
    } else {
      const res = await api.createPaciente(form)
      if (res.acceso) {
        setAccesoCreado(res.acceso)
      } else {
        setModal(false)
      }
    }
    cargar()
  }

  async function eliminar(id, e) {
    e.stopPropagation()
    if (!confirm('¿Eliminar paciente y todos sus datos?')) return
    await api.deletePaciente(id)
    cargar()
  }

  const filtrados = pacientes.filter(p =>
    `${p.nombre} ${p.apellido} ${p.email || ''} ${p.dni || ''}`.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div className="kine-page">
      <div className="kine-page-header">
        <h1 className="kine-page-title">Pacientes <span className="kine-page-count">{pacientes.length}</span></h1>
        <div className="kine-page-actions">
          <input className="kine-search" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <button className="kine-btn-primary" onClick={abrirNuevo}>+ Nuevo paciente</button>
        </div>
      </div>

      {loading
        ? <div className="kine-loading">Cargando...</div>
        : filtrados.length === 0
          ? <div className="kine-empty">No hay pacientes aún</div>
          : (
            <div className="pacientes-grid">
              {filtrados.map(p => (
                <div key={p.id} className="paciente-card" onClick={() => navigate(`/kine/paciente/${p.id}`)}>
                  <div className="paciente-card-avatar">{p.nombre[0]}{p.apellido[0]}</div>
                  <div className="paciente-card-info">
                    <div className="paciente-card-nombre">{p.nombre} {p.apellido}</div>
                    {p.edad && <div className="paciente-card-os">{p.edad} años</div>}
                    {p.celular && <div className="paciente-card-os">{p.celular}</div>}
                    {p.email && <div className="paciente-card-os">{p.email}</div>}
                    {p.usuario_id && <div className="paciente-card-os" style={{ color: 'var(--kine-ok)' }}>✓ Acceso activo</div>}
                  </div>
                  <div className="paciente-card-btns">
                    <button className="kine-btn-icon" onClick={e => abrirEditar(p, e)} title="Editar">✎</button>
                    <button className="kine-btn-icon danger" onClick={e => eliminar(p.id, e)} title="Eliminar">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )
      }

      <Modal open={modal} onClose={() => setModal(false)} titulo={editId ? 'Editar paciente' : 'Nuevo paciente'}>
        {accesoCreado ? (
          /* Pantalla de confirmación con datos de acceso */
          <div className="kine-acceso-info">
            <div className="kine-acceso-ok">✅ Paciente creado con acceso al portal</div>
            <p style={{ fontSize: 13, color: 'var(--kine-text-2)', marginBottom: '1rem' }}>
              Compartí estos datos con el paciente para que pueda ver su ficha:
            </p>
            <div className="kine-acceso-datos">
              <div><span>URL</span><strong>/kine</strong></div>
              <div><span>Email</span><strong>{accesoCreado.email}</strong></div>
              <div><span>Contraseña</span><strong>{accesoCreado.password}</strong></div>
            </div>
            <button className="kine-btn-primary" style={{ marginTop: '1.25rem', width: '100%' }} onClick={() => setModal(false)}>
              Listo
            </button>
          </div>
        ) : (
          <form className="kine-form" onSubmit={guardar}>
            <div className="kine-form-row">
              <label>Nombre *<input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} /></label>
              <label>Apellido *<input required value={form.apellido} onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))} /></label>
            </div>
            <div className="kine-form-row">
              <label>Edad<input type="number" min="0" max="120" value={form.edad} onChange={e => setForm(f => ({ ...f, edad: e.target.value }))} /></label>
              <label>DNI<input value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} placeholder="Se usa como contraseña" /></label>
            </div>
            <div className="kine-form-row">
              <label>Email<input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
              <label>Celular<input value={form.celular} onChange={e => setForm(f => ({ ...f, celular: e.target.value }))} placeholder="Ej: 11 2345-6789" /></label>
            </div>
            {!editId && form.email && (
              <div className="kine-form-hint" style={{ background: 'var(--kine-accent-bg)', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                Se creará acceso al portal con email <strong>{form.email}</strong> y contraseña <strong>{form.dni || form.celular || '123456'}</strong>
              </div>
            )}
            <div className="kine-form-footer">
              <button type="button" className="kine-btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="kine-btn-primary">{editId ? 'Guardar' : 'Crear paciente'}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
