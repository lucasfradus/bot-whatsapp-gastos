import { useEffect, useState } from 'react'
import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom'
import { api } from './api.js'
import Login from './Login.jsx'
import Dashboard from './Dashboard.jsx'
import Pacientes from './Pacientes.jsx'
import PacienteDetalle from './PacienteDetalle.jsx'
import Ejercicios from './Ejercicios.jsx'
import Agenda from './Agenda.jsx'
import KineClaude from './KineClaude.jsx'
import PortalPaciente from './PortalPaciente.jsx'
import './kine.css'

function AdminLayout({ usuario, onLogout }) {
  return (
    <div className="kine-app">
      <nav className="kine-nav">
        <div className="kine-nav-brand">
          <span className="kine-nav-logo">⚕</span>
          <div>
            <div className="kine-nav-title">Kinesiología Ciuró</div>
            <div className="kine-nav-sub">Panel de administración</div>
          </div>
        </div>
        <div className="kine-nav-links">
          <NavLink to="/kine" end className={({ isActive }) => isActive ? 'kine-link active' : 'kine-link'}>Dashboard</NavLink>
          <NavLink to="/kine/pacientes" className={({ isActive }) => isActive ? 'kine-link active' : 'kine-link'}>Pacientes</NavLink>
          <NavLink to="/kine/agenda" className={({ isActive }) => isActive ? 'kine-link active' : 'kine-link'}>Agenda</NavLink>
          <NavLink to="/kine/ejercicios" className={({ isActive }) => isActive ? 'kine-link active' : 'kine-link'}>Ejercicios</NavLink>
          <NavLink to="/kine/claude" className={({ isActive }) => isActive ? 'kine-link active' : 'kine-link'}>Claude</NavLink>
        </div>
        <div className="kine-nav-right">
          <span className="kine-nav-usuario">{usuario?.nombre}</span>
          <button className="kine-btn-logout" onClick={onLogout}>Salir</button>
        </div>
      </nav>
      <div className="kine-content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pacientes" element={<Pacientes />} />
          <Route path="/paciente/:id" element={<PacienteDetalle />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/ejercicios" element={<Ejercicios />} />
          <Route path="/claude" element={<KineClaude />} />
          <Route path="*" element={<Navigate to="/kine" replace />} />
        </Routes>
      </div>
    </div>
  )
}

function PacienteLayout({ usuario, paciente, onLogout }) {
  return (
    <div className="kine-app">
      <nav className="kine-nav">
        <div className="kine-nav-brand">
          <span className="kine-nav-logo">⚕</span>
          <div>
            <div className="kine-nav-title">Kinesiología Ciuró</div>
            <div className="kine-nav-sub">Mi portal</div>
          </div>
        </div>
        <div className="kine-nav-right">
          <span className="kine-nav-usuario">{usuario?.nombre}</span>
          <button className="kine-btn-logout" onClick={onLogout}>Salir</button>
        </div>
      </nav>
      <div className="kine-content">
        <Routes>
          <Route path="/*" element={<PortalPaciente paciente={paciente} />} />
        </Routes>
      </div>
    </div>
  )
}

export default function KineApp() {
  const [auth, setAuth] = useState(null) // { usuario, paciente }
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('kine_token')
    if (!token) { setLoading(false); return }
    api.me()
      .then(data => setAuth(data))
      .catch(() => localStorage.removeItem('kine_token'))
      .finally(() => setLoading(false))
  }, [])

  function handleLogin(data) {
    localStorage.setItem('kine_token', data.token)
    setAuth({ usuario: data.usuario, paciente: data.paciente })
  }

  function handleLogout() {
    localStorage.removeItem('kine_token')
    setAuth(null)
    navigate('/kine/login')
  }

  if (loading) return (
    <div className="kine-app kine-splash">
      <div className="kine-splash-logo">⚕</div>
      <div className="kine-splash-titulo">Kinesiología Ciuró</div>
    </div>
  )

  if (!auth) return (
    <div className="kine-app">
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/kine/login" replace />} />
      </Routes>
    </div>
  )

  if (auth.usuario.rol === 'admin') {
    return <AdminLayout usuario={auth.usuario} onLogout={handleLogout} />
  }

  return <PacienteLayout usuario={auth.usuario} paciente={auth.paciente} onLogout={handleLogout} />
}
