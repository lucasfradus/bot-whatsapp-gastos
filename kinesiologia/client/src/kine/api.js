const BASE = '/api/kine'

function getToken() {
  return localStorage.getItem('kine_token')
}

async function req(method, path, body) {
  const token = getToken()
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (res.status === 401) {
    localStorage.removeItem('kine_token')
    window.location.href = '/kine/login'
    return
  }
  if (!res.ok) throw new Error((await res.json()).error || res.statusText)
  return res.json()
}

export const api = {
  // Auth
  login:  (data) => req('POST', '/login', data),
  me:     () => req('GET', '/me'),

  // Pacientes
  getPacientes:   () => req('GET', '/pacientes'),
  getPaciente:    (id) => req('GET', `/pacientes/${id}`),
  createPaciente: (data) => req('POST', '/pacientes', data), // devuelve { paciente, acceso }
  updatePaciente: (id, data) => req('PUT', `/pacientes/${id}`, data),
  deletePaciente: (id) => req('DELETE', `/pacientes/${id}`),
  crearAcceso:    (id, data) => req('POST', `/pacientes/${id}/crear-acceso`, data),

  // Lesiones
  getLesiones:   (pacienteId) => req('GET', `/pacientes/${pacienteId}/lesiones`),
  createLesion:  (data) => req('POST', '/lesiones', data),
  updateLesion:  (id, data) => req('PUT', `/lesiones/${id}`, data),
  deleteLesion:  (id) => req('DELETE', `/lesiones/${id}`),

  // Sesiones
  getSesiones:   (lesionId) => req('GET', `/lesiones/${lesionId}/sesiones`),
  createSesion:  (data) => req('POST', '/sesiones', data),
  updateSesion:  (id, data) => req('PUT', `/sesiones/${id}`, data),
  deleteSesion:  (id) => req('DELETE', `/sesiones/${id}`),

  // Ejercicios
  getEjercicios:   () => req('GET', '/ejercicios'),
  createEjercicio: (data) => req('POST', '/ejercicios', data),
  updateEjercicio: (id, data) => req('PUT', `/ejercicios/${id}`, data),
  deleteEjercicio: (id) => req('DELETE', `/ejercicios/${id}`),

  // Ejercicios por paciente
  getEjerciciosPaciente: (id) => req('GET', `/pacientes/${id}/ejercicios`),
  asignarEjercicio:      (id, data) => req('POST', `/pacientes/${id}/ejercicios`, data),
  quitarEjercicio:       (id) => req('DELETE', `/paciente-ejercicios/${id}`),

  // Dashboard
  getDashboard: () => req('GET', '/dashboard'),

  // Turnos
  getTurnos:   (mes) => req('GET', `/turnos${mes ? `?mes=${mes}` : ''}`),
  createTurno: (data) => req('POST', '/turnos', data),
  updateTurno: (id, data) => req('PUT', `/turnos/${id}`, data),
  deleteTurno: (id) => req('DELETE', `/turnos/${id}`),

  // Documentos
  getDocumentos:   (pacienteId) => req('GET', `/pacientes/${pacienteId}/documentos`),
  deleteDocumento: (id) => req('DELETE', `/documentos/${id}`),
  uploadDocumento: (pacienteId, formData) => {
    const token = localStorage.getItem('kine_token')
    return fetch(`/api/kine/pacientes/${pacienteId}/documentos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => r.json())
  },

  // Motivos de consulta
  getMotivos:       (pacienteId) => req('GET', `/pacientes/${pacienteId}/motivos`),
  createMotivo:     (pacienteId, data) => req('POST', `/pacientes/${pacienteId}/motivos`, data),
  updateMotivo:     (id, data) => req('PUT', `/motivos/${id}`, data),
  deleteMotivo:     (id) => req('DELETE', `/motivos/${id}`),

  // Evoluciones
  getEvoluciones:   (motivoId) => req('GET', `/motivos/${motivoId}/evoluciones`),
  createEvolucion:  (motivoId, data) => req('POST', `/motivos/${motivoId}/evoluciones`, data),
  updateEvolucion:  (id, data) => req('PUT', `/evoluciones/${id}`, data),
  deleteEvolucion:  (id) => req('DELETE', `/evoluciones/${id}`),
  togglePagado:     (id) => req('PATCH', `/evoluciones/${id}/pagar`),
  pagarTodo:        (pacienteId) => req('POST', `/pacientes/${pacienteId}/pagar-todo`),
  getSaldo:         (pacienteId) => req('GET', `/pacientes/${pacienteId}/saldo`),

  // Ejercicios de gimnasio (última sesión)
  getEjerciciosGimnasio: (pacienteId) => req('GET', `/pacientes/${pacienteId}/ejercicios-gimnasio`),

  // Estudios
  getEstudios:      (motivoId) => req('GET', `/motivos/${motivoId}/estudios`),
  deleteEstudio:    (id) => req('DELETE', `/estudios/${id}`),
  uploadEstudio:    (motivoId, formData) => {
    const token = localStorage.getItem('kine_token')
    return fetch(`/api/kine/motivos/${motivoId}/estudios`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => r.json())
  },

  // Dolor
  getDolorEvolucion: (id) => req('GET', `/pacientes/${id}/dolor`),
}
