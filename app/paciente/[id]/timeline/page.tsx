'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

type EventoTipo = 'nota' | 'medicamento' | 'documento' | 'especialista'

type Evento = {
  id: string
  tipo: EventoTipo
  titulo: string
  descripcion: string
  autor: string
  fecha: string
}

const COLORES: Record<EventoTipo, { bg: string; text: string; border: string; dot: string }> = {
  nota:         { bg: '#eff6ff', text: '#1A6BFF', border: '#93c5fd', dot: '#1A6BFF' },
  medicamento:  { bg: '#f0fdf4', text: '#16a34a', border: '#86efac', dot: '#00C97A' },
  documento:    { bg: '#fffbeb', text: '#b45309', border: '#fcd34d', dot: '#f59e0b' },
  especialista: { bg: '#faf5ff', text: '#7c3aed', border: '#c4b5fd', dot: '#8b5cf6' },
}

const LABELS: Record<EventoTipo, string> = {
  nota:         'Nota clínica',
  medicamento:  'Medicamento',
  documento:    'Documento',
  especialista: 'Especialista',
}

const EMOJIS: Record<EventoTipo, string> = {
  nota:         '📋',
  medicamento:  '💊',
  documento:    '📁',
  especialista: '👤',
}

const TIPOS_NOTA: Record<string, string> = {
  consulta:       'Consulta',
  sesion_terapia: 'Sesión de terapia',
  urgencia:       'Urgencia',
  seguimiento:    'Seguimiento',
  interconsulta:  'Interconsulta',
}

export default function TimelinePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const pacienteId = params.id as string

  const [eventos, setEventos] = useState<Evento[]>([])
  const [paciente, setPaciente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<EventoTipo | 'all'>('all')
  const [stats, setStats] = useState({ notas: 0, medicamentos: 0, documentos: 0, especialistas: 0 })

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: pac } = await supabase
        .from('pacientes').select('nombre').eq('id', pacienteId).single()
      setPaciente(pac)

      const todos: Evento[] = []

      const { data: notas } = await supabase
        .from('notas_clinicas')
        .select('id, tipo_nota, motivo, plan, fecha_consulta, autor_nombre, especialidad')
        .eq('paciente_id', pacienteId)
        .is('deleted_at', null)

      for (const n of notas || []) {
        todos.push({
          id:          'nota-' + n.id,
          tipo:        'nota',
          titulo:      TIPOS_NOTA[n.tipo_nota] || n.tipo_nota,
          descripcion: n.motivo || n.plan || 'Sin descripcion',
          autor:       n.autor_nombre + (n.especialidad ? ' - ' + n.especialidad : ''),
          fecha:       n.fecha_consulta,
        })
      }

      const { data: meds } = await supabase
        .from('medicamentos_activos')
        .select('id, nombre_medicamento, dosis, frecuencia, indicado_por, fecha_inicio, fecha_suspension, created_at')
        .eq('paciente_id', pacienteId)
        .is('deleted_at', null)

      for (const m of meds || []) {
        todos.push({
          id:          'med-' + m.id,
          tipo:        'medicamento',
          titulo:      m.nombre_medicamento,
          descripcion: (m.dosis || '') + (m.frecuencia ? ' - ' + m.frecuencia : '') || 'Sin dosis',
          autor:       m.indicado_por || 'Sin especificar',
          fecha:       m.fecha_inicio || m.created_at,
        })

        if (m.fecha_suspension) {
          todos.push({
            id:          'med-susp-' + m.id,
            tipo:        'medicamento',
            titulo:      m.nombre_medicamento + ' (suspendido)',
            descripcion: 'Medicamento suspendido',
            autor:       'Familia',
            fecha:       m.fecha_suspension,
          })
        }
      }

      const { data: docs } = await supabase
        .from('documentos')
        .select('id, nombre, categoria, tipo, created_at, subido_por')
        .eq('paciente_id', pacienteId)
        .is('deleted_at', null)

      for (const d of docs || []) {
        const { data: autor } = await supabase
          .from('users').select('full_name').eq('id', d.subido_por).single()
        todos.push({
          id:          'doc-' + d.id,
          tipo:        'documento',
          titulo:      d.nombre || 'Documento',
          descripcion: d.categoria || d.tipo || 'Sin categoria',
          autor:       autor?.full_name || 'Familia',
          fecha:       d.created_at,
        })
      }

      const { data: accesos } = await supabase
        .from('expediente_accesos')
        .select('id, usuario_id, created_at')
        .eq('paciente_id', pacienteId)
        .eq('estado', 'activo')

      for (const a of accesos || []) {
        const { data: u } = await supabase
          .from('users').select('full_name, role, especialidad').eq('id', a.usuario_id).single()
        if (!u) continue
        todos.push({
          id:          'esp-' + a.id,
          tipo:        'especialista',
          titulo:      u.full_name || 'Profesional',
          descripcion: u.especialidad || u.role || 'Sin especialidad',
          autor:       'Invitado por la familia',
          fecha:       a.created_at,
        })
      }

      todos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      setEventos(todos)
      setStats({
        notas:        (notas || []).length,
        medicamentos: (meds || []).length,
        documentos:   (docs || []).length,
        especialistas: (accesos || []).length,
      })
      setLoading(false)
    }
    cargar()
  }, [])

  function formatFecha(fecha: string) {
    return new Date(fecha).toLocaleDateString('es-MX', {
      day: 'numeric', month: 'long', year: 'numeric'
    })
  }

  const eventosFiltrados = filtro === 'all' ? eventos : eventos.filter(e => e.tipo === filtro)

  if (loading) return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-slate-400">Cargando timeline...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-white">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#1A6BFF] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#1A6BFF]">Medic</span>
          </span>
        </div>
        <Link href={'/paciente/' + pacienteId} className="text-slate-500 hover:text-slate-900 text-sm transition-colors">
          Regresar
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">Timeline medico</h1>
          <p className="text-slate-500 text-sm mt-1">{paciente?.nombre} - Historial cronologico del expediente</p>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-3 mb-8">
          {[
            { label: 'Notas',        value: stats.notas,        color: '#1A6BFF' },
            { label: 'Medicamentos', value: stats.medicamentos, color: '#00C97A' },
            { label: 'Documentos',   value: stats.documentos,   color: '#f59e0b' },
            { label: 'Especialistas',value: stats.especialistas, color: '#8b5cf6' },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-xl px-1 py-3 text-center">
              <div className="text-xl font-semibold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[10.5px] sm:text-xs text-slate-400 mt-0.5 leading-tight break-words">{s.label}</div>
            </div>
          ))}
        </div>

        <div
          className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 mb-8 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={(e) => {
            const el = e.currentTarget
            const startX = e.pageX - el.offsetLeft
            const startScroll = el.scrollLeft
            function mover(ev: MouseEvent) {
              el.scrollLeft = startScroll - (ev.pageX - el.offsetLeft - startX)
            }
            function soltar() {
              window.removeEventListener('mousemove', mover)
              window.removeEventListener('mouseup', soltar)
            }
            window.addEventListener('mousemove', mover)
            window.addEventListener('mouseup', soltar)
          }}
        >
          <button
            onClick={() => setFiltro('all')}
            className={'flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-all ' + (filtro === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200')}
          >
            Todos
          </button>
          {(['nota', 'medicamento', 'documento', 'especialista'] as EventoTipo[]).map(t => (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              style={filtro === t ? { background: COLORES[t].bg, color: COLORES[t].text, borderColor: COLORES[t].border } : {}}
              className={'flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium border transition-all ' + (filtro === t ? '' : 'bg-white text-slate-500 border-slate-200')}
            >
              {EMOJIS[t]} {LABELS[t]}
            </button>
          ))}
        </div>
        <style jsx>{`
          .scrollbar-none::-webkit-scrollbar { display: none; }
          .scrollbar-none { scrollbar-width: none; -ms-overflow-style: none; }
        `}</style>

        {eventosFiltrados.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-4">📭</p>
            <p className="text-slate-500">No hay eventos de este tipo aun.</p>
          </div>
        ) : (
          <div>
            {eventosFiltrados.map((evento, idx) => {
              const c = COLORES[evento.tipo]
              const esUltimo = idx === eventosFiltrados.length - 1
              return (
                <div key={evento.id} className="flex gap-4">
                  <div className="flex flex-col items-center flex-shrink-0 w-5">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                      style={{ background: c.dot, boxShadow: '0 0 0 2px white, 0 0 0 3px ' + c.dot }}
                    />
                    {!esUltimo && <div className="w-px flex-1 bg-slate-200 my-1" />}
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: c.bg, color: c.text }}
                        >
                          {EMOJIS[evento.tipo]} {LABELS[evento.tipo]}
                        </span>
                        <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                          {formatFecha(evento.fecha)}
                        </span>
                      </div>
                      <p className="text-slate-900 font-semibold text-sm mb-1">{evento.titulo}</p>
                      <p className="text-slate-500 text-sm">{evento.descripcion}</p>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: c.bg, color: c.text }}
                        >
                          {evento.autor.charAt(0)}
                        </div>
                        <span className="text-xs text-slate-400">{evento.autor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}