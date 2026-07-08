"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'

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
  tipo: 'sueno_inicio' | 'sueno_despertar' | 'sueno_fin'
  hora_inicio: string
  hora_fin: string | null
  motivo: string | null
  nota: string | null
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function minutosEntre(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000)
}

function severidad(minutos: number): 'gris' | 'moderado' | 'severo' {
  if (minutos < 15) return 'gris'
  if (minutos <= 60) return 'moderado'
  return 'severo'
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function BitacoraSuenoPage() {
  const params = useParams()
  const pacienteId = params.id as string
  const router = useRouter()
  const supabase = createClient()

  const [rol, setRol] = useState<Rol>('familia')
  const [paciente, setPaciente] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<'hoy' | 'historial'>('hoy')

  const [fechaSeleccionada, setFechaSeleccionada] = useState(hoyISO())
  const [registros, setRegistros] = useState<Registro[]>([])
  const [historial, setHistorial] = useState<{ fecha: string, horas: number, maxSeveridad: 'gris' | 'moderado' | 'severo' | null }[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)

  const [modalSimple, setModalSimple] = useState<null | 'dormir' | 'fin'>(null)
  const [horaSimple, setHoraSimple] = useState('20:40')
  const [guardandoSimple, setGuardandoSimple] = useState(false)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [horaDespierto, setHoraDespierto] = useState('03:00')
  const [horaVolvio, setHoraVolvio] = useState('03:10')
  const [motivo, setMotivo] = useState('sin_causa')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  const esFamilia = rol === 'familia'

  useEffect(() => { cargarDatos() }, [])
  useEffect(() => { if (!loading) cargarNoche(fechaSeleccionada) }, [fechaSeleccionada])
  useEffect(() => { if (!loading && vista === 'historial' && historial.length === 0) cargarHistorial() }, [vista])

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
    setRol((userData?.role || user.user_metadata?.role || 'familia') as Rol)

    const { data: pac } = await supabase.from('pacientes').select('id, nombre').eq('id', pacienteId).single()
    setPaciente(pac)

    await cargarNoche(fechaSeleccionada)
    setLoading(false)
  }

  async function cargarNoche(fecha: string) {
    const { data } = await supabase
      .from('bitacora_registros')
      .select('id, tipo, hora_inicio, hora_fin, motivo, nota')
      .eq('paciente_id', pacienteId)
      .eq('noche_fecha', fecha)
      .in('tipo', ['sueno_inicio', 'sueno_despertar', 'sueno_fin'])
      .order('hora_inicio', { ascending: true })
    setRegistros(data || [])
  }

  async function cargarHistorial() {
    setCargandoHistorial(true)
    const desde = new Date()
    desde.setDate(desde.getDate() - 29)

    const { data } = await supabase
      .from('bitacora_registros')
      .select('tipo, hora_inicio, hora_fin, noche_fecha')
      .eq('paciente_id', pacienteId)
      .in('tipo', ['sueno_inicio', 'sueno_despertar', 'sueno_fin'])
      .gte('noche_fecha', desde.toISOString().slice(0, 10))
      .order('noche_fecha', { ascending: true })

    const porNoche: Record<string, any[]> = {}
    ;(data || []).forEach(r => {
      if (!porNoche[r.noche_fecha]) porNoche[r.noche_fecha] = []
      porNoche[r.noche_fecha].push(r)
    })

    const resultado = Object.entries(porNoche).map(([fecha, regs]) => {
      const inicioNoche = regs.find(r => r.tipo === 'sueno_inicio')
      const finNoche = regs.find(r => r.tipo === 'sueno_fin')
      const desperts = regs.filter(r => r.tipo === 'sueno_despertar' && r.hora_fin)

      if (!inicioNoche || !finNoche) return { fecha, horas: 0, maxSeveridad: null }

      const enCamaMin = minutosEntre(inicioNoche.hora_inicio, finNoche.hora_inicio)
      const despiertaMin = desperts.reduce((acc, d) => acc + minutosEntre(d.hora_inicio, d.hora_fin), 0)
      const horas = Math.max(0, (enCamaMin - despiertaMin) / 60)

      let maxSev: 'gris' | 'moderado' | 'severo' | null = null
      desperts.forEach(d => {
        const sev = severidad(minutosEntre(d.hora_inicio, d.hora_fin))
        if (sev === 'severo') maxSev = 'severo'
        else if (sev === 'moderado' && maxSev !== 'severo') maxSev = 'moderado'
      })

      return { fecha, horas, maxSeveridad: maxSev }
    }).sort((a, b) => a.fecha.localeCompare(b.fecha))

    setHistorial(resultado)
    setCargandoHistorial(false)
  }

  const inicio = registros.find(r => r.tipo === 'sueno_inicio')
  const fin = registros.find(r => r.tipo === 'sueno_fin')
  const despertares = registros.filter(r => r.tipo === 'sueno_despertar')

  const resumen = useMemo(() => {
    if (!inicio || !fin) return null
    const enCamaMin = minutosEntre(inicio.hora_inicio, fin.hora_inicio)
    const despiertaMin = despertares
      .filter(d => d.hora_fin)
      .reduce((acc, d) => acc + minutosEntre(d.hora_inicio, d.hora_fin as string), 0)
    return { enCamaMin, despiertaMin, realMin: enCamaMin - despiertaMin }
  }, [inicio, fin, despertares])

  function cambiarDia(delta: number) {
    const d = new Date(fechaSeleccionada + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    setFechaSeleccionada(d.toISOString().slice(0, 10))
  }

  function abrirModalDormir() {
    setHoraSimple('20:40')
    setModalSimple('dormir')
  }

  function abrirModalFin() {
    setHoraSimple('06:50')
    setModalSimple('fin')
  }

  async function guardarSimple() {
    if (!horaSimple || !modalSimple) return
    setGuardandoSimple(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: modalSimple === 'dormir' ? 'sueno_inicio' : 'sueno_fin',
      noche_fecha: fechaSeleccionada,
      hora_inicio: `${fechaSeleccionada}T${horaSimple}:00`,
      registrado_por: user?.id,
    })
    setGuardandoSimple(false)
    setModalSimple(null)
    await cargarNoche(fechaSeleccionada)
  }

  async function guardarDespertar() {
    setGuardando(true)
    const horaInicioIso = `${fechaSeleccionada}T${horaDespierto}:00`
    let fechaFin = fechaSeleccionada
    if (horaVolvio < horaDespierto) {
      const d = new Date(fechaSeleccionada + 'T12:00:00')
      d.setDate(d.getDate() + 1)
      fechaFin = d.toISOString().slice(0, 10)
    }
    const horaFinIso = `${fechaFin}T${horaVolvio}:00`

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: 'sueno_despertar',
      noche_fecha: fechaSeleccionada,
      hora_inicio: horaInicioIso,
      hora_fin: horaFinIso,
      motivo,
      nota: nota || null,
      registrado_por: user?.id,
    })

    setModalAbierto(false)
    setGuardando(false)
    setNota('')
    await cargarNoche(fechaSeleccionada)
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#4C4FE0] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">Syncro<span className="text-[#4C4FE0]">Medic</span></span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm">← Regresar</Link>
      </nav>

      <div className="max-w-md mx-auto px-6 py-8">
        <div className="flex bg-slate-100 rounded-xl p-1 mb-5">
          <button onClick={() => setVista('hoy')} className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors ${vista === 'hoy' ? 'bg-white text-[#4C4FE0] shadow-sm' : 'text-slate-500'}`}>Hoy</button>
          <button onClick={() => setVista('historial')} className={`flex-1 text-sm font-bold py-2 rounded-lg transition-colors ${vista === 'historial' ? 'bg-white text-[#4C4FE0] shadow-sm' : 'text-slate-500'}`}>Historial</button>
        </div>

        {vista === 'hoy' && (
          <>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#EEEEFC] flex items-center justify-center text-lg">🌙</div>
                <div>
                  <h1 className="text-slate-800 text-xl font-bold">Sueño</h1>
                  <p className="text-slate-500 text-sm">{paciente?.nombre}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => cambiarDia(-1)} className="w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm">‹</button>
                <span className="text-xs font-semibold text-slate-600 w-20 text-center">
                  {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                </span>
                <button onClick={() => cambiarDia(1)} disabled={fechaSeleccionada >= hoyISO()} className="w-7 h-7 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center text-sm disabled:opacity-30">›</button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-sm text-slate-800">Ritmo de la noche</h2>
                {resumen && (
                  <span className="text-xs font-bold text-[#4C4FE0] bg-[#EEEEFC] px-2.5 py-1 rounded-full">
                    {Math.floor(resumen.realMin / 60)}h {resumen.realMin % 60}min dormidas
                  </span>
                )}
              </div>

              {!inicio || !fin ? (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm mb-4">
                    {!inicio ? 'Aún no se registra la hora en que se durmió.' : 'Falta registrar la hora en que despertó definitivamente.'}
                  </p>
                  {esFamilia && (
                    <button
                      onClick={!inicio ? abrirModalDormir : abrirModalFin}
                      className="bg-[#4C4FE0] text-white text-sm font-bold px-4 py-2.5 rounded-xl"
                    >
                      {!inicio ? '+ Registrar que se durmió' : '+ Registrar despertar final'}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="text-center py-2">
                    <p className="font-bold text-2xl text-slate-800">{formatHora(inicio.hora_inicio)}</p>
                    <p className="text-slate-400 text-xs mt-1">hasta {formatHora(fin.hora_inicio)}</p>
                  </div>
                  <div className="flex justify-around border-t border-slate-100 pt-3 mt-3 text-center">
                    <div>
                      <p className="font-bold text-sm">{Math.floor(resumen!.enCamaMin / 60)}h {resumen!.enCamaMin % 60}min</p>
                      <p className="text-[10px] text-slate-400">en cama</p>
                    </div>
                    <div>
                      <p className="font-bold text-sm">−{resumen!.despiertaMin} min</p>
                      <p className="text-[10px] text-slate-400">despierta</p>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[#4C4FE0]">{Math.floor(resumen!.realMin / 60)}h {resumen!.realMin % 60}min</p>
                      <p className="text-[10px] text-slate-400">sueño real</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {despertares.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm">
                <h2 className="font-bold text-sm text-slate-800 mb-3">Despertares</h2>
                <div className="flex flex-col gap-3">
                  {despertares.map(d => {
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
              </div>
            )}

            {esFamilia && inicio && (
              <button
                onClick={() => setModalAbierto(true)}
                className="w-full bg-[#4C4FE0] text-white text-sm font-bold py-3.5 rounded-2xl"
              >
                + Registrar despertar nocturno
              </button>
            )}
          </>
        )}

        {vista === 'historial' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-sm text-slate-800 mb-1">Últimos 30 días</h2>
            <p className="text-slate-400 text-xs mb-4">Cada barra es una noche. El punto marca un despertar moderado (ámbar) o severo (rojo).</p>

            {cargandoHistorial ? (
              <p className="text-slate-400 text-sm text-center py-8">Cargando historial...</p>
            ) : historial.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Aún no hay suficientes registros para mostrar el historial.</p>
            ) : (
              <div className="flex items-end gap-[3px] h-36 relative pt-5">
                {[8, 10, 12].map(hRef => (
                  <div key={hRef} className="absolute left-0 right-0 border-t border-dashed border-slate-300" style={{ bottom: `${(hRef / 12) * 100}%` }}>
                    <span className="absolute -left-0.5 -top-2 text-[9px] text-slate-400 bg-white pr-0.5">{hRef}h</span>
                  </div>
                ))}
                {historial.map((n, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative z-10" title={`${n.fecha} · ${n.horas.toFixed(1)}h`}>
                    {n.maxSeveridad && n.maxSeveridad !== 'gris' && (
                      <div className={`w-1.5 h-1.5 rounded-full mb-1 ${n.maxSeveridad === 'severo' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    )}
                    <div
                      className="w-full max-w-[9px] bg-[#4C4FE0] rounded-t"
                      style={{ height: `${Math.min(100, (n.horas / 12) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-slate-800 text-lg font-bold mb-1">Registrar despertar nocturno</h2>
            <p className="text-slate-400 text-xs mb-5">{paciente?.nombre} · esta noche</p>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Se despertó a las</label>
                <input type="time" value={horaDespierto} onChange={e => setHoraDespierto(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#4C4FE0]" />
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Volvió a dormir a las</label>
                <input type="time" value={horaVolvio} onChange={e => setHoraVolvio(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#4C4FE0]" />
              </div>
            </div>

            <div className="mb-4">
              <label className="text-slate-500 text-xs mb-1 block">Motivo</label>
              <select value={motivo} onChange={e => setMotivo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#4C4FE0]">
                {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="mb-5">
              <label className="text-slate-500 text-xs mb-1 block">Nota adicional (opcional)</label>
              <textarea rows={3} value={nota} onChange={e => setNota(e.target.value)}
                placeholder="Ej. se le acompañó de vuelta a dormir..."
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#4C4FE0]" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalAbierto(false)} className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-xl">Cancelar</button>
              <button onClick={guardarDespertar} disabled={guardando} className="flex-1 bg-[#4C4FE0] text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {modalSimple && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-slate-800 text-lg font-bold mb-1">
              {modalSimple === 'dormir' ? 'Registrar que se durmió' : 'Registrar despertar final'}
            </h2>
            <p className="text-slate-400 text-xs mb-5">{paciente?.nombre} · {new Date(fechaSeleccionada + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>

            <div className="mb-6">
              <label className="text-slate-500 text-xs mb-1 block">
                {modalSimple === 'dormir' ? 'Se durmió a las' : 'Despertó definitivamente a las'}
              </label>
              <input
                type="time"
                value={horaSimple}
                onChange={e => setHoraSimple(e.target.value)}
                autoFocus
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#4C4FE0]"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setModalSimple(null)} className="flex-1 bg-slate-100 text-slate-600 text-sm font-bold py-3 rounded-xl">Cancelar</button>
              <button onClick={guardarSimple} disabled={guardandoSimple} className="flex-1 bg-[#4C4FE0] text-white text-sm font-bold py-3 rounded-xl disabled:opacity-50">
                {guardandoSimple ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}