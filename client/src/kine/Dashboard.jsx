import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from './api.js'

function StatCard({ icono, valor, label, color, onClick }) {
  return (
    <div className={`dash-stat ${onClick ? 'clickable' : ''}`} onClick={onClick} style={{ borderTop: `3px solid ${color}` }}>
      <div className="dash-stat-icono">{icono}</div>
      <div className="dash-stat-valor">{valor}</div>
      <div className="dash-stat-label">{label}</div>
    </div>
  )
}

const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Dashboard() {
  const [data, setData] = useState(null)
  const navigate = useNavigate()

  useEffect(() => { api.getDashboard().then(setData) }, [])

  if (!data) return <div className="kine-loading">Cargando...</div>

  const { stats, sesionesPorMes, proximosTurnos } = data

  const chartData = [...sesionesPorMes].reverse().map(s => {
    const [anio, mes] = s.mes.split('-')
    return { mes: `${MESES_CORTOS[parseInt(mes) - 1]} ${anio.slice(2)}`, sesiones: s.cantidad }
  })

  return (
    <div className="kine-page">
      <div className="kine-page-header">
        <h1 className="kine-page-title">Dashboard</h1>
        <span className="dash-fecha">{new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="dash-stats-grid">
        <StatCard icono="👥" valor={stats.total_pacientes} label="Pacientes totales" color="#0ea5e9" onClick={() => navigate('/kine/pacientes')} />
        <StatCard icono="🩹" valor={stats.lesiones_activas} label="Lesiones activas" color="#f59e0b" />
        <StatCard icono="📋" valor={stats.sesiones_mes} label="Sesiones este mes" color="#8b5cf6" />
        <StatCard icono="📅" valor={stats.turnos_hoy} label="Turnos hoy" color="#10b981" onClick={() => navigate('/kine/agenda')} />
        <StatCard icono="⏳" valor={stats.turnos_proximos} label="Turnos próximos" color="#6366f1" onClick={() => navigate('/kine/agenda')} />
      </div>

      <div className="dash-grid">
        {/* Gráfico sesiones por mes */}
        <div className="dash-card">
          <div className="dash-card-titulo">Sesiones por mes</div>
          {chartData.length === 0
            ? <div className="kine-empty" style={{ padding: '40px 0' }}>Sin datos aún</div>
            : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="sesiones" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Próximos turnos */}
        <div className="dash-card">
          <div className="dash-card-titulo">Próximos turnos</div>
          {proximosTurnos.length === 0
            ? <div className="kine-empty-sm">Sin turnos próximos</div>
            : (
              <div className="dash-turnos-lista">
                {proximosTurnos.map(t => (
                  <div key={t.id} className="dash-turno" onClick={() => navigate('/kine/agenda')}>
                    <div className="dash-turno-fecha">
                      <div className="dash-turno-dia">{new Date(t.fecha + 'T12:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                      <div className="dash-turno-hora">{t.hora}</div>
                    </div>
                    <div className="dash-turno-info">
                      <div className="dash-turno-pac">{t.nombre} {t.apellido}</div>
                      {t.motivo && <div className="dash-turno-motivo">{t.motivo}</div>}
                    </div>
                    <span className={`kine-estado ${t.estado}`}>{t.estado}</span>
                  </div>
                ))}
              </div>
            )
          }
          <button className="dash-ver-mas" onClick={() => navigate('/kine/agenda')}>Ver agenda completa →</button>
        </div>
      </div>
    </div>
  )
}
