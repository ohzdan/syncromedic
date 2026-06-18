'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

type Recomendacion = {
  id: string
  titulo: string
  contenido: string
  created_at: string
  autor_id: string
  autor_nombre?: string
}

type UserRol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'

export default function RecomendacionesPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const pacienteId = params.id as string

  const [recomendaciones, setRecomendaciones] = useState<Recomendacion[]>([])
  const [rolUsuario, setRolUsuario] = useState<UserRol | null>(null)
  const [paciente, setPaciente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState({ titulo: '', contenido: '' })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const puedeCrear = ['familia', 'medico', 'terapeuta', 'centro_terapias'].includes(rolUsuario ?? '')

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: userData } = await supabase
        .from('users').select('role').eq('id', user.id).single()
      setRolUsuario(userData?.role as UserRol)

      const { data: pacienteData } = await supabase
        .from('pacientes').select('nombre').eq('id', pacienteId).single()
      setPaciente(pacienteData)

      await cargarRecomendaciones()
      setLoading(false)
    }
    cargar()
  }, [])

  async function cargarRecomendaciones() {
    const { data } = await supabase
      .from('recomendaciones_escuela')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false })

    if (data) {
      const conNombres = await Promise.all(data.map(async (rec) => {
        const { data: autor } = await supabase
          .from('users').select('nombre').eq('id', rec.autor_id).single()
        return { ...rec, autor_nombre: autor?.nombre ?? 'Desconocido' }
      }))
      setRecomendaciones(conNombres)
    }
  }

  async function handleGuardar() {
    if (!form.titulo || !form.contenido) return
    setGuardando(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: err } = await supabase
      .from('recomendaciones_escuela')
      .insert({
        paciente_id: pacienteId,
        autor_id: user.id,
        titulo: form.titulo,
        contenido: form.contenido,
      })

    if (err) { setError(err.message); setGuardando(false); return }

    setForm({ titulo: '', contenido: '' })
    setMostrarForm(false)
    await cargarRecomendaciones()
    setGuardando(false)
  }

  function formatFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando recomendaciones...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-500 hover:text-slate-900 text-sm transition-colors">
          ← Regresar
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Recomendaciones</h1>
            <p className="text-slate-500 text-sm mt-1">
              {paciente?.nombre} · Indicaciones para el entorno escolar
            </p>
          </div>
          {puedeCrear && !mostrarForm && (
            <button
              onClick={() => setMostrarForm(true)}
              className="bg-[#1A6BFF] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
            >
              + Nueva recomendación
            </button>
          )}
        </div>

        {rolUsuario === 'escuela' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
            📋 Aquí puedes ver las recomendaciones que el equipo médico y terapéutico ha preparado para apoyar a este paciente en el entorno escolar.
          </div>
        )}

        {mostrarForm && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 shadow-sm">
            <h2 className="text-slate-900 font-semibold mb-4">Nueva recomendación</h2>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Título</label>
              <input
                type="text"
                value={form.titulo}
                onChange={e => setForm({ ...form, titulo: e.target.value })}
                placeholder="Ej: Adaptaciones en el aula"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#1A6BFF]"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Contenido</label>
              <textarea
                value={form.contenido}
                onChange={e => setForm({ ...form, contenido: e.target.value })}
                placeholder="Describe las recomendaciones específicas para la escuela..."
                rows={5}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#1A6BFF] resize-none"
              />
            </div>

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleGuardar}
                disabled={guardando || !form.titulo || !form.contenido}
                className="bg-[#1A6BFF] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {guardando ? 'Guardando...' : 'Guardar recomendación'}
              </button>
              <button
                onClick={() => { setMostrarForm(false); setForm({ titulo: '', contenido: '' }) }}
                className="px-5 py-2.5 rounded-lg text-sm text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {recomendaciones.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-4">📝</p>
            <p className="text-slate-900 font-semibold mb-2">Sin recomendaciones aún</p>
            <p className="text-slate-500 text-sm">
              {puedeCrear
                ? 'Agrega la primera recomendación para la escuela.'
                : 'El equipo médico aún no ha agregado recomendaciones.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {recomendaciones.map(rec => (
              <div key={rec.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-slate-900 font-semibold">{rec.titulo}</h3>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{formatFecha(rec.created_at)}</span>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{rec.contenido}</p>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                  <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-xs text-[#1A6BFF] font-bold">
                    {rec.autor_nombre?.charAt(0) ?? '?'}
                  </div>
                  <span className="text-xs text-slate-400">{rec.autor_nombre}</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}