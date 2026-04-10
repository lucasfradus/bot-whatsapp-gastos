import { useState } from 'react'
import { api } from './api.js'

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await api.login(form)
      onLogin(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="kine-login-wrap">
      <div className="kine-login-card">
        <div className="kine-login-logo">⚕</div>
        <h1 className="kine-login-titulo">Kinesiología Ciuró</h1>
        <p className="kine-login-sub">Ingresá con tu cuenta</p>

        <form className="kine-form" onSubmit={handleSubmit}>
          <label>Email
            <input
              type="email"
              required
              autoFocus
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="tu@email.com"
            />
          </label>
          <label>Contraseña
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="••••••"
            />
          </label>
          {error && <div className="kine-login-error">{error}</div>}
          <button className="kine-btn-primary kine-login-btn" type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
