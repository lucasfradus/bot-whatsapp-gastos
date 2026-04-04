import { useEffect, useState } from 'react'
import { api } from './api.js'
import Modal from './Modal.jsx'

const CATEGORIAS = ['Fortalecimiento', 'Movilidad', 'Estiramiento', 'Propiocepción', 'Cardiovascular', 'Respiratorio', 'Otro']
const EMPTY = { nombre: '', descripcion: '', categoria: '', video_url: '' }

export default function Ejercicios() {
  const [ejercicios, setEjercicios] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setEjercicios(await api.getEjercicios())
  }

  function abrirNuevo() { setForm(EMPTY); setEditId(null); setModal(true) }
  function abrirEditar(e) { setForm({ nombre: e.nombre, descripcion: e.descripcion || '', categoria: e.categoria || '', video_url: e.video_url || '' }); setEditId(e.id); setModal(true) }

  async function guardar(e) {
    e.preventDefault()
    if (editId) await api.updateEjercicio(editId, form)
    else await api.createEjercicio(form)
    setModal(false)
    cargar()
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar ejercicio?')) return
    await api.deleteEjercicio(id)
    cargar()
  }

  const categorias = [...new Set(ejercicios.map(e => e.categoria).filter(Boolean))]

  const filtrados = ejercicios.filter(e => {
    const matchBusq = `${e.nombre} ${e.descripcion}`.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = !catFiltro || e.categoria === catFiltro
    return matchBusq && matchCat
  })

  return (
    <div className="kine-page">
      <div className="kine-page-header">
        <h1 className="kine-page-title">Biblioteca de ejercicios</h1>
        <div className="kine-page-actions">
          <input className="kine-search" placeholder="Buscar ejercicio..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          <select className="kine-select" value={catFiltro} onChange={e => setCatFiltro(e.target.value)}>
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="kine-btn-primary" onClick={abrirNuevo}>+ Nuevo ejercicio</button>
        </div>
      </div>

      {filtrados.length === 0
        ? <div className="kine-empty">No hay ejercicios{busqueda || catFiltro ? ' que coincidan' : ' aún'}</div>
        : (
          <div className="kine-ej-grid">
            {filtrados.map(e => (
              <div key={e.id} className="kine-ej-card">
                <div className="kine-ej-header">
                  <span className="kine-ej-cat">{e.categoria || 'General'}</span>
                  <div>
                    <button className="kine-btn-icon-sm" onClick={() => abrirEditar(e)}>✎</button>
                    <button className="kine-btn-icon-sm danger" onClick={() => eliminar(e.id)}>✕</button>
                  </div>
                </div>
                <div className="kine-ej-nombre">{e.nombre}</div>
                {e.descripcion && <div className="kine-ej-desc">{e.descripcion}</div>}
                {e.video_url && (
                  <a href={e.video_url} target="_blank" rel="noreferrer" className="kine-ej-video">▶ Ver video</a>
                )}
              </div>
            ))}
          </div>
        )
      }

      <Modal open={modal} onClose={() => setModal(false)} titulo={editId ? 'Editar ejercicio' : 'Nuevo ejercicio'}>
        <form className="kine-form" onSubmit={guardar}>
          <label>Nombre *
            <input required value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Ej: Sentadilla con apoyo" />
          </label>
          <label>Categoría
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              <option value="">Sin categoría</option>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Descripción
            <textarea rows={3} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Cómo realizarlo, músculos involucrados..." />
          </label>
          <label>Link de video (YouTube, etc.)
            <input type="url" value={form.video_url} onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))} placeholder="https://..." />
          </label>
          <div className="kine-form-footer">
            <button type="button" className="kine-btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="kine-btn-primary">{editId ? 'Guardar' : 'Crear ejercicio'}</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
