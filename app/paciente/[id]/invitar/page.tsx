'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function InvitarMedico() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const pacienteId = params.id as string

  const [form, setForm] = useState({
    nombre_medico: '',
    especialidad: '',
    email_medico: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkGenerado, setLinkGenerado] = useState('')

  async function handleInvitar() {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('No hay sesión activa'); setLoading(false); return }

    const { data, error: err } = await supabase
      .from('invitaciones')
      .insert({
        paciente_id: pacienteId,
        invitado_por: user.id,
        email_medico: form.email_medico,
        nombre_medico: form.nombre_medico,
        especialidad: form.especialidad,
      })
      .select()
      .single()

    if (err) { setError(err.message); setLoading(false); return }

    const link = `${window.location.origin}/invitacion/${data.token}`
    setLinkGenerado(link)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '480px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', marginBottom: '8px' }}>Invitar médico</h1>
        <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '14px' }}>El médico recibirá un link para acceder al expediente.</p>

        {!linkGenerado ? (
          <>
            {['nombre_medico', 'especialidad', 'email_medico'].map((campo) => (
              <div key={campo} style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                  {campo === 'nombre_medico' ? 'Nombre del médico' : campo === 'especialidad' ? 'Especialidad' : 'Correo electrónico'}
                </label>
                <input
                  type={campo === 'email_medico' ? 'email' : 'text'}
                  value={form[campo as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [campo]: e.target.value })}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            ))}

            {error && <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

            <button
              onClick={handleInvitar}
              disabled={loading || !form.nombre_medico || !form.especialidad || !form.email_medico}
              style={{ width: '100%', padding: '12px', background: '#1A6BFF', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Generando invitación...' : 'Generar link de invitación'}
            </button>
          </>
        ) : (
          <div>
            <p style={{ color: '#16a34a', fontWeight: '600', marginBottom: '12px' }}>✅ Link generado</p>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>Copia este link y mándalo al médico por WhatsApp o correo:</p>
            <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '12px', wordBreak: 'break-all', fontSize: '13px', color: '#1A6BFF', marginBottom: '20px' }}>
              {linkGenerado}
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(linkGenerado) }}
              style={{ width: '100%', padding: '12px', background: '#00C97A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '12px' }}
            >
              Copiar link
            </button>
            <button
              onClick={() => router.push(`/paciente/${pacienteId}`)}
              style={{ width: '100%', padding: '12px', background: 'white', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', cursor: 'pointer' }}
            >
              Volver al expediente
            </button>
          </div>
        )}
      </div>
    </div>
  )
}