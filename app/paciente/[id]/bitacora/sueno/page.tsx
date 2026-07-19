"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const MOTIVOS = [
  { value: 'terror_nocturno', label: 'Terror nocturno' },
  { value: 'pesadilla', label: 'Pesadilla' },
  { value: 'hambre_sed', label: 'Hambre o sed' },
  { value: 'bano_panal', label: 'Necesidad de ir al baño / pañal' },
  { value: 'dolor', label: 'Dolor o malestar físico' },
  { value: 'enfermedad', label: 'Enfermedad (fiebre, tos, congestión)' },
  { value: 'convulsion', label: 'Convulsión' },
  { value: 'ruido_ambiental', label: 'Ruido o estímulo ambiental' },
  { value: 'ansiedad_separacion', label: 'Ansiedad de separación' },
  { value: 'sin_causa', label: 'Sin causa aparente' },
]

type Registro = {
  id: string
  tipo: 'sueno_inicio' | 'sueno_despertar' | 'sueno_fin' | 'pipi_nocturno'
  hora_inicio: string
  hora_fin: string | null
  motivo: string | null
  nota: string | null
  pipi_nocturno: boolean | null
  noche_fecha: string
}

type DetalleNoche = {
  inicio?: Registro
  fin?: Registro
  despertares: Registro[]
  pipi?: Registro
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatFechaCorta(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function formatFechaLarga(fecha: string) {
  return new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
}

function minutosEntre(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}

function horasDormidas(detalle: DetalleNoche) {
  if (!detalle.inicio || !detalle.fin) return 0
  const enCamaMin = minutosEntre(detalle.inicio.hora_inicio, detalle.fin.hora_inicio)
  const despiertaMin = detalle.despertares
    .filter(d => d.hora_fin)
    .reduce((acc, d) => acc + minutosEntre(d.hora_inicio, d.hora_fin as string), 0)
  return Math.max(0, (enCamaMin - despiertaMin) / 60)
}

function severidad(minutos: number): 'gris' | 'moderado' | 'severo' {
  if (minutos < 15) return 'gris'
  if (minutos <= 60) return 'moderado'
  return 'severo'
}

export default function BitacoraSuenoPage() {
  const params = useParams()
  const pacienteId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [paciente, setPaciente] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [historial, setHistorial] = useState<{ fecha: string, horas: number, maxSeveridad: 'gris' | 'moderado' | 'severo' | null, pipi: boolean }[]>([])
  const [detallePorNoche, setDetallePorNoche] = useState<Record<string, DetalleNoche>>({})
  const [cargandoHistorial, setCargandoHistorial] = useState(true)
  const [nocheSeleccionada, setNocheSeleccionada] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const arrastre = useRef({ activo: false, x: 0, scrollLeft: 0 })

  function iniciarArrastre(e: React.MouseEvent) {
    const el = scrollRef.current
    if (!el) return
    arrastre.current = { activo: true, x: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft }
  }
  function moverArrastre(e: React.MouseEvent) {
    const el = scrollRef.current
    if (!el || !arrastre.current.activo) return
    e.preventDefault()
    const x = e.pageX - el.offsetLeft
    el.scrollLeft = arrastre.current.scrollLeft - (x - arrastre.current.x)
  }
  function terminarArrastre() {
    arrastre.current.activo = false
  }

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: pac } = await supabase.from('pacientes').select('id, nombre').eq('id', pacienteId).single()
    setPaciente(pac)

    await cargarHistorial()
    setLoading(false)
  }

  async function cargarHistorial() {
    setCargandoHistorial(true)
    const desde = new Date()
    desde.setDate(desde.getDate() - 59)

    const { data } = await supabase
      .from('bitacora_registros')
      .select('id, tipo, hora_inicio, hora_fin, motivo, nota, pipi_nocturno, noche_fecha')
      .eq('paciente_id', pacienteId)
      .in('tipo', ['sueno_inicio', 'sueno_despertar', 'sueno_fin', 'pipi_nocturno'])
      .is('deleted_at', null)
      .gte('noche_fecha', desde.toISOString().slice(0, 10))
      .order('noche_fecha', { ascending: true })

    const porNoche: Record<string, Registro[]> = {}
    ;(data || []).forEach((r: Registro) => {
      if (!porNoche[r.noche_fecha]) porNoche[r.noche_fecha] = []
      porNoche[r.noche_fecha].push(r)
    })

    const detalle: Record<string, DetalleNoche> = {}
    const resultado = Object.entries(porNoche).map(([fecha, regs]) => {
      const inicioNoche = regs.find(r => r.tipo === 'sueno_inicio')
      const finNoche = regs.find(r => r.tipo === 'sueno_fin')
      const desperts = regs.filter(r => r.tipo === 'sueno_despertar')
      const pipi = regs.find(r => r.tipo === 'pipi_nocturno')

      detalle[fecha] = { inicio: inicioNoche, fin: finNoche, despertares: desperts, pipi }

      const huboPipi = !!pipi?.pipi_nocturno

      if (!inicioNoche || !finNoche) return { fecha, horas: 0, maxSeveridad: null, pipi: huboPipi }

      const despertsConDuracion = desperts.filter(d => d.hora_fin)
      const horas = horasDormidas(detalle[fecha])

      let maxSev: 'gris' | 'moderado' | 'severo' | null = null
      despertsConDuracion.forEach(d => {
        const sev = severidad(minutosEntre(d.hora_inicio, d.hora_fin as string))
        if (sev === 'severo') maxSev = 'severo'
        else if (sev === 'moderado' && maxSev !== 'severo') maxSev = 'moderado'
      })

      return { fecha, horas, maxSeveridad: maxSev, pipi: huboPipi }
    }).sort((a, b) => a.fecha.localeCompare(b.fecha))

    setDetallePorNoche(detalle)
    setHistorial(resultado)
    setCargandoHistorial(false)
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    })
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando...</p>
    </main>
  )

  const detalleModal = nocheSeleccionada ? detallePorNoche[nocheSeleccionada] : null

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg bg-[#4C4FE0] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">Syncro<span className="text-[#4C4FE0]">Medic</span></span>
        </Link>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm">← Regresar</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-[#EEEEFC] flex items-center justify-center text-lg">🌙</div>
          <div>
            <h1 className="text-slate-800 text-xl font-bold">Sueño</h1>
            <p className="text-slate-500 text-sm">{paciente?.nombre}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-sm text-slate-800 mb-1">Últimos 60 días</h2>
          <p className="text-slate-400 text-xs mb-3">Cada barra es una noche · desliza para ver más · toca una barra para el detalle completo.</p>

          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-500 text-[11px]">Despertar moderado (15–60 min)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-500 text-[11px]">Despertar severo (&gt;60 min)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] leading-none">💧</span>
              <span className="text-slate-500 text-[11px]">Pipí nocturno</span>
            </div>
          </div>

          {cargandoHistorial ? (
            <p className="text-slate-400 text-sm text-center py-8">Cargando historial...</p>
          ) : historial.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Aún no hay suficientes registros para mostrar el historial.</p>
          ) : (
            <div
              ref={scrollRef}
              className="overflow-x-auto cursor-grab active:cursor-grabbing select-none -mx-1 px-1"
              onMouseDown={iniciarArrastre}
              onMouseMove={moverArrastre}
              onMouseUp={terminarArrastre}
              onMouseLeave={terminarArrastre}
            >
              {(() => {
                const maxHorasObservado = Math.max(0, ...historial.map(n => n.horas))
                const escalaBase = Math.max(12, Math.ceil(maxHorasObservado))
                const escalaGrafica = escalaBase * 1.15 // headroom para que la barra más alta no toque el techo
                return (
                  <div className="flex items-end gap-[3px] h-36 relative pl-7 w-max">
                    {[8, 10, 12].map(hRef => (
                      <div key={hRef} className="absolute left-0 right-0 border-t border-dashed border-slate-300" style={{ bottom: `${(hRef / escalaGrafica) * 100}%` }}>
                        <span className="absolute left-0 -top-2 text-[9px] text-slate-400 bg-white pr-1">{hRef}h</span>
                      </div>
                    ))}
                    {historial.map((n, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setNocheSeleccionada(n.fecha)}
                        className="w-4 shrink-0 flex flex-col items-center justify-end h-full relative z-10"
                        title={`${formatFechaCorta(n.fecha)} · ${n.horas.toFixed(1)}h`}
                      >
                        {n.pipi && (
                          <span className="text-[9px] leading-none mb-0.5" title="Pipí nocturno">💧</span>
                        )}
                        {n.maxSeveridad && n.maxSeveridad !== 'gris' && (
                          <div className={`w-1.5 h-1.5 rounded-full mb-1 ${n.maxSeveridad === 'severo' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        )}
                        <div
                          className="w-full max-w-[9px] bg-[#4C4FE0] rounded-t hover:opacity-70 transition-opacity"
                          style={{ height: `${Math.max(0, (n.horas / escalaGrafica) * 100)}%` }}
                        />
                      </button>
                    ))}
                  </div>
                )
              })()}
              <div className="flex gap-[3px] mt-1 pl-7 w-max">
                {historial.map((n, i) => (
                  <div key={i} className="w-4 shrink-0 text-center">
                    {(i % 7 === 0 || i === historial.length - 1) && (
                      <span className="text-[8px] text-slate-400 whitespace-nowrap">{formatFechaCorta(n.fecha)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {detalleModal && nocheSeleccionada && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setNocheSeleccionada(null)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-slate-800 text-lg font-bold mb-1 capitalize">{formatFechaLarga(nocheSeleccionada)}</h2>
            <p className="text-slate-400 text-xs mb-5">{paciente?.nombre}</p>

            {!detalleModal.inicio || !detalleModal.fin ? (
              <p className="text-slate-400 text-sm text-center py-6">No hay registro completo de sueño para esta noche.</p>
            ) : (
              <div className="bg-slate-50 rounded-xl p-4 mb-4">
                <p className="text-slate-700 text-sm text-center">
                  Se durmió a las <span className="font-bold text-slate-900">{formatHora(detalleModal.inicio.hora_inicio)}</span> y despertó a las <span className="font-bold text-slate-900">{formatHora(detalleModal.fin.hora_inicio)}</span>.
                </p>
                <p className="text-slate-800 text-center font-bold text-lg mt-1">
                  Durmió {horasDormidas(detalleModal).toFixed(1)} horas
                </p>
                {detalleModal.despertares.some(d => d.hora_fin) && (
                  <p className="text-slate-400 text-[11px] text-center mt-0.5">
                    (ya se restaron los despertares nocturnos con duración registrada)
                  </p>
                )}
                {detalleModal.pipi?.pipi_nocturno && (
                  <div className="flex justify-center">
                    <span className="inline-block mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      💧 Pipí nocturno
                    </span>
                  </div>
                )}
              </div>
            )}

            <h3 className="text-slate-700 text-sm font-bold mb-2">Despertares nocturnos</h3>
            {detalleModal.despertares.length === 0 ? (
              <p className="text-slate-400 text-sm mb-2">Ninguno registrado esta noche.</p>
            ) : (
              <div className="flex flex-col gap-3 mb-2">
                {detalleModal.despertares.map(d => {
                  const dur = d.hora_fin ? minutosEntre(d.hora_inicio, d.hora_fin) : null
                  const sev = dur !== null ? severidad(dur) : 'gris'
                  return (
                    <div key={d.id} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-slate-800">
                          {formatHora(d.hora_inicio)} {d.hora_fin && <span className="text-slate-400 font-medium">→ {formatHora(d.hora_fin)}</span>}
                        </p>
                        {dur !== null && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sev === 'severo' ? 'bg-red-50 text-red-600' : sev === 'moderado' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                            {dur} min
                          </span>
                        )}
                      </div>
                      {d.nota && <p className="text-slate-500 text-xs mb-1">{d.nota}</p>}
                      {d.motivo && (
                        <span className="text-[11px] font-semibold text-[#4C4FE0] bg-[#EEEEFC] px-2 py-0.5 rounded-full">
                          {MOTIVOS.find(m => m.value === d.motivo)?.label}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button onClick={() => setNocheSeleccionada(null)} className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-xl">
                Cerrar
              </button>
              <button
                onClick={() => router.push(`/paciente/${pacienteId}?editarSueno=${nocheSeleccionada}`)}
                className="flex-1 bg-[#4C4FE0] hover:bg-[#3d3fc7] text-white text-sm font-bold py-3 rounded-xl transition-colors"
              >
                ✏️ Editar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}