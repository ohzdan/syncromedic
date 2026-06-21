'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

const LABELS_ROL: Record<string, string> = {
  medico:          'Médico',
  terapeuta:       'Terapeuta',
  centro_terapias: 'Centro de terapias',
  escuela:         'Escuela',
}

const ICONOS_ROL: Record<string, string> = {
  medico:          '🩺',
  terapeuta:       '🧠',
  centro_terapias: '🏥',
  escuela:         '🏫',
}

export default function AceptarInvitacion() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const token = params.token as string

  const [invitacion, setInvitacion] = useState<any>(null)
  const [paciente, setPaciente] = useState<any>(null)
  const [estado, setEstado] = useState<'cargando' | 'valida' | 'invalida' | 'aceptada'>('cargando')
  const [modo, setModo] = useState<'elegir' | 'login' | 'registro'>('elegir')
  const [form, setForm] = useState({ email: '', password: '', cedula: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function cargarInvitacion() {
      const { data, error } = await supabase
        .from('invitaciones')
        .select('*')
        .eq('token', token)
        .single()

      if (error || !data) { setEstado('invalida'); return }
      if (data.estado === 'aceptada') { setEstado('aceptada'); return }
      if (new Date(data.expires_at) < new Date()) { setEstado('invalida'); return }

      setInvitacion(data)

      const { data: pacienteData } = await supabase
        .from('pacientes')
        .select('nombre, diagnostico_principal')
        .eq('id', data.paciente_id)
        .single()

      setPaciente(pacienteData)
      setEstado('valida')
    }
    cargarInvitacion()
  }, [token])

  async function handleLogin() {
    setLoading(true)
    setError('')

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (loginError) { setError('Correo o contraseña incorrectos'); setLoading(false); return }

    await aceptarInvitacion()
  }

  async function handleRegistro() {
    setLoading(true)
    setError('')

    const rol = invitacion?.rol ?? 'medico'

    const { error: regError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name:   invitacion.nombre_medico,
          role:        rol,
          especialidad: invitacion.especialidad,
          cedula:      form.cedula,
        }
      }
    })

    if (regError) { setError(regError.message); setLoading(false); return }

    await aceptarInvitacion()
  }

  async function aceptarInvitacion() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Error al obtener sesión'); setLoading(false); return }

    // Actualizar el rol del usuario según la invitación
    const rol = invitacion?.rol ?? 'medico'
    await supabase
      .from('users')
      .update({ role: rol })
      .eq('id', user.id)

    // Crear acceso al expediente
    await supabase.from('expediente_accesos').insert({
      paciente_id:          invitacion.paciente_id,
      usuario_id:           user.id,
      invitado_por:         invitacion.invitado_por,
      estado:               'activo',
      consentimiento_firmado: true,
      consentimiento_fecha: new Date().toISOString(),
    })

    // Marcar invitación como aceptada
    await supabase.from('invitaciones')
      .update({ estado: 'aceptada' })
      .eq('token', token)

    router.push('/dashboard')
  }

  if (estado === 'cargando') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <p style={{ color: '#64748b' }}>Verificando invitación...</p>
    </div>
  )

  if (estado === 'invalida') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
        <p style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</p>
        <h2 style={{ color: '#0f172a', marginBottom: '8px' }}>Invitación no válida</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Este link expiró o ya no es válido. Pide a la familia que genere uno nuevo.</p>
      </div>
    </div>
  )

  if (estado === 'aceptada') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', maxWidth: '400px' }}>
        <p style={{ fontSize: '48px', marginBottom: '16px' }}>✅</p>
        <h2 style={{ color: '#0f172a', marginBottom: '8px' }}>Invitación ya aceptada</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>Ya tienes acceso a este expediente.</p>
        <button onClick={() => router.push('/dashboard')} style={{ marginTop: '20px', padding: '12px 24px', background: '#1A6BFF', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
          Ir al dashboard
        </button>
      </div>
    </div>
  )

  const rolLabel = LABELS_ROL[invitacion?.rol] ?? invitacion?.especialidad
  const rolIcono = ICONOS_ROL[invitacion?.rol] ?? '👤'

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        {/* Info del paciente */}
        <div style={{ background: '#f0f9ff', borderRadius: '12px', padding: '16px', marginBottom: '28px' }}>
          <p style={{ fontSize: '13px', color: '#0369a1', fontWeight: '600', marginBottom: '4px' }}>
            Te invitaron al expediente de
          </p>
          <p style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '4px' }}>
            {paciente?.nombre}
          </p>
          <p style={{ fontSize: '13px', color: '#64748b' }}>{paciente?.diagnostico_principal}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
            <span style={{ fontSize: '16px' }}>{rolIcono}</span>
            <span style={{ fontSize: '13px', color: '#0369a1', fontWeight: '500' }}>
              Tu rol: {rolLabel}
            </span>
          </div>
          {invitacion?.rol === 'escuela' && (
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
              ⚠️ Solo tendrás acceso a la sección de Recomendaciones.
            </p>
          )}
        </div>

        {modo === 'elegir' && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>
              Hola, {invitacion?.nombre_medico}
            </h2>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '24px' }}>
              ¿Ya tienes cuenta en SyncroMedic?
            </p>
            <button
              onClick={() => setModo('login')}
              style={{ width: '100%', padding: '12px', background: '#1A6BFF', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '12px' }}
            >
              Sí, tengo cuenta
            </button>
            <button
              onClick={() => setModo('registro')}
              style={{ width: '100%', padding: '12px', background: 'white', color: '#1A6BFF', border: '2px solid #1A6BFF', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}
            >
              No, crear cuenta nueva
            </button>
          </>
        )}

        {(modo === 'login' || modo === 'registro') && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#0f172a', marginBottom: '24px' }}>
              {modo === 'login' ? 'Inicia sesión' : 'Crea tu cuenta'}
            </h2>

            {modo === 'registro' && invitacion?.rol === 'medico' && (
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  Cédula profesional
                </label>
                <input
                  type="text"
                  value={form.cedula}
                  onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                Contraseña
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' }}
              />
            </div>

            {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

            <button
              onClick={modo === 'login' ? handleLogin : handleRegistro}
              disabled={loading}
              style={{ width: '100%', padding: '12px', background: '#1A6BFF', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '12px', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Procesando...' : modo === 'login' ? 'Entrar y aceptar' : 'Crear cuenta y aceptar'}
            </button>

            <button
              onClick={() => setModo('elegir')}
              style={{ width: '100%', padding: '10px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', cursor: 'pointer' }}
            >
              Regresar
            </button>
          </>
        )}
      </div>
    </div>
  )
}