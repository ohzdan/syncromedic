'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

export default function EquipoMedico() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const pacienteId = params.id as string

  const [paciente, setPaciente] = useState<any>(null)
  const [equipo, setEquipo] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [revocando, setRevocando] = useState<string | null>(null)
  const [rol, setRol] = useState("")

  useEffect(() => {
    cargar()
  }, [pacienteId])

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    setRol(userData?.role || '')

    const { data: pacienteData } = await supabase
      .from('pacientes')
      .select('nombre')
      .eq('id', pacienteId)
      .single()
    setPaciente(pacienteData)

    await cargarEquipo()
    setLoading(false)
  }

  async function cargarEquipo() {
    const { data: accesos } = await supabase
      .from('expediente_accesos')
      .select('usuario_id, created_at, estado')
      .eq('paciente_id', pacienteId)
      .eq('estado', 'activo')

    if (accesos && accesos.length > 0) {
      const ids = accesos.map((a: any) => a.usuario_id)
      const { data: medicos } = await supabase
        .from('users')
        .select('id, full_name, role, especialidad, cedula_profesional')
        .in('id', ids)

      const equipoConFecha = (medicos || []).map((m: any) => ({
        ...m,
        desde: accesos.find((a: any) => a.usuario_id === m.id)?.created_at
      }))
      setEquipo(equipoConFecha)
    } else {
      setEquipo([])
    }
  }

  async function revocarAcceso(medicoId: string, medicoNombre: string) {
    if (!confirm(`¿Revocar el acceso de ${medicoNombre} al expediente? Ya no podrá ver la información del paciente.`)) return

    setRevocando(medicoId)
    await supabase
      .from('expediente_accesos')
      .update({ estado: 'revocado' })
      .eq('paciente_id', pacienteId)
      .eq('usuario_id', medicoId)

    await cargarEquipo()
    setRevocando(null)
  }

  function formatFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  const esFamilia = rol === 'familia'

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

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-slate-900 text-2xl font-semibold">Equipo médico</h1>
            {paciente && <p className="text-slate-500 text-sm mt-1">Especialistas con acceso al expediente de {paciente.nombre}</p>}
          </div>
          {esFamilia && (
            <Link
              href={`/paciente/${pacienteId}/invitar`}
              className="bg-[#1A6BFF] hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              + Invitar médico
            </Link>
          )}
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm">Cargando...</p>
        ) : equipo.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-4">🩺</p>
            <h2 className="text-slate-900 font-semibold mb-2">Sin especialistas vinculados</h2>
            <p className="text-slate-500 text-sm mb-6">Invita al primer médico para que pueda ver el expediente</p>
            {esFamilia && (
              <Link
                href={`/paciente/${pacienteId}/invitar`}
                className="bg-[#1A6BFF] hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-block"
              >
                Invitar médico
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {equipo.map((medico) => (
              <div key={medico.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
                    🩺
                  </div>
                  <div className="flex-1">
                    <h2 className="text-slate-900 font-semibold">{medico.full_name || 'Sin nombre'}</h2>
                    <p className="text-slate-500 text-sm">{medico.especialidad || medico.role}</p>
                    {medico.cedula_profesional && (
                      <p className="text-slate-400 text-xs mt-0.5">Cédula: {medico.cedula_profesional}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full">Activo</span>
                    {medico.desde && <p className="text-slate-400 text-xs mt-1.5">Desde {formatFecha(medico.desde)}</p>}
                  </div>
                </div>

                {esFamilia && (
                  <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => revocarAcceso(medico.id, medico.full_name || 'este médico')}
                      disabled={revocando === medico.id}
                      className="text-red-400 hover:text-red-600 text-xs font-medium px-3 py-1.5 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {revocando === medico.id ? 'Revocando...' : 'Revocar acceso'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}