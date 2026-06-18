'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

type TipoProfesional = 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela'

const TIPOS: { value: TipoProfesional; label: string; icon: string; descripcion: string }[] = [
  { value: 'medico',          label: 'Médico',              icon: '🩺', descripcion: 'Especialista con cédula profesional' },
  { value: 'terapeuta',       label: 'Terapeuta',           icon: '🧠', descripcion: 'Psicólogo, terapeuta de lenguaje, ocupacional, etc.' },
  { value: 'centro_terapias', label: 'Centro de terapias',  icon: '🏥', descripcion: 'Institución que provee terapias al paciente' },
  { value: 'escuela',         label: 'Escuela',             icon: '🏫', descripcion: 'Solo verá recomendaciones del equipo médico' },
]

const LABEL_NOMBRE: Record<TipoProfesional, string> = {
  medico:          'Nombre del médico',
  terapeuta:       'Nombre del terapeuta',
  centro_terapias: 'Nombre del centro',
  escuela:         'Nombre de la escuela',
}

const LABEL_ESPECIALIDAD: Record<TipoProfesional, string> = {
  medico:          'Especialidad',
  terapeuta:       'Tipo de terapia',
  centro_terapias: 'Nombre del contacto',
  escuela:         'Nombre del contacto',
}

export default function InvitarProfesional() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const pacienteId = params.id as string

  const [tipo, setTipo] = useState<TipoProfesional | null>(null)
  const [form, setForm] = useState({ nombre: '', especialidad: '', email: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkGenerado, setLinkGenerado] = useState('')
  const [copiado, setCopiado] = useState(false)

  async function handleInvitar() {
    if (!tipo) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('No hay sesión activa'); setLoading(false); return }

    const { data, error: err } = await supabase
      .from('invitaciones')
      .insert({
        paciente_id:   pacienteId,
        invitado_por:  user.id,
        email_medico:  form.email,
        nombre_medico: form.nombre,
        especialidad:  form.especialidad,
        rol:           tipo,
      })
      .select()
      .single()

    if (err) { setError(err.message); setLoading(false); return }

    setLinkGenerado(`${window.location.origin}/invitacion/${data.token}`)
    setLoading(false)
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkGenerado)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const tipoSeleccionado = TIPOS.find(t => t.value === tipo)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '500px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
          Invitar profesional
        </h1>
        <p style={{ color: '#64748b', marginBottom: '28px', fontSize: '14px' }}>
          El profesional recibirá un link para acceder al expediente.
        </p>

        {!linkGenerado ? (
          <>
            {/* Selector de tipo */}
            <p style={{ fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '10px' }}>
              Tipo de profesional
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
              {TIPOS.map(t => (
                <button
                  key={t.value}
                  onClick={() => setTipo(t.value)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: tipo === t.value ? '2px solid #1A6BFF' : '1px solid #e2e8f0',
                    background: tipo === t.value ? '#eff6ff' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>{t.icon}</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: tipo === t.value ? '#1A6BFF' : '#0f172a' }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', lineHeight: '1.4' }}>
                    {t.descripcion}
                  </div>
                </button>
              ))}
            </div>

            {/* Aviso escuela */}
            {tipo === 'escuela' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: '#92400e' }}>
                ⚠️ La escuela solo podrá ver la sección de <strong>Recomendaciones</strong>. No tendrá acceso a notas clínicas, medicamentos ni documentos.
              </div>
            )}

            {/* Campos dinámicos */}
            {tipo && (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    {LABEL_NOMBRE[tipo]}
                  </label>
                  <input
                    type="text"
                    value={form.nombre}
                    onChange={e => setForm({ ...form, nombre: e.target.value })}
                    placeholder={tipo === 'medico' ? 'Dr. Juan Ramírez' : tipo === 'terapeuta' ? 'Lic. Ana Flores' : 'Centro APANA'}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    {LABEL_ESPECIALIDAD[tipo]}
                  </label>
                  <input
                    type="text"
                    value={form.especialidad}
                    onChange={e => setForm({ ...form, especialidad: e.target.value })}
                    placeholder={
                      tipo === 'medico'          ? 'Neurología pediátrica' :
                      tipo === 'terapeuta'       ? 'Terapia de lenguaje' :
                      tipo === 'centro_terapias' ? 'Coordinadora: Lic. Martínez' :
                      'Directora: Profra. García'
                    }
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {error && (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
                )}

                <button
                  onClick={handleInvitar}
                  disabled={loading || !form.nombre || !form.especialidad || !form.email}
                  style={{ width: '100%', padding: '12px', background: '#1A6BFF', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', opacity: (loading || !form.nombre || !form.especialidad || !form.email) ? 0.5 : 1 }}
                >
                  {loading ? 'Generando invitación...' : `Invitar ${tipoSeleccionado?.label.toLowerCase()}`}
                </button>
              </>
            )}
          </>
        ) : (
          /* Pantalla de link generado */
          <div>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ fontSize: '40px', marginBottom: '8px' }}>{tipoSeleccionado?.icon}</div>
              <p style={{ color: '#16a34a', fontWeight: '600', fontSize: '16px' }}>¡Invitación generada!</p>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                Manda este link a <strong>{form.nombre}</strong> por WhatsApp o correo
              </p>
            </div>

            <div style={{ background: '#f1f5f9', borderRadius: '8px', padding: '12px', wordBreak: 'break-all', fontSize: '13px', color: '#1A6BFF', marginBottom: '16px' }}>
              {linkGenerado}
            </div>

            <button
              onClick={copiarLink}
              style={{ width: '100%', padding: '12px', background: copiado ? '#00C97A' : '#1A6BFF', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginBottom: '10px', transition: 'background 0.2s' }}
            >
              {copiado ? '✅ Link copiado' : 'Copiar link'}
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