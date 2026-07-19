'use client'

import { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'

type Consistencia = 'normal' | 'blanda' | 'dura' | 'diarrea'

type Registro = {
  id: string
  hora_inicio: string
  consistencia: Consistencia | null
  foto_url: string | null
  nota: string | null
  registrado_por: string
}

const CONSISTENCIA_LABELS: Record<Consistencia, string> = {
  normal: 'Normal',
  blanda: 'Blanda',
  dura: 'Dura',
  diarrea: 'Diarrea',
}

// Colores del sistema de diseño de SyncroMedic + acentos del mockup de bitácora
const AZUL = '#1A6BFF'
const VERDE = '#00C97A'
const VERDE_SUAVE = '#E6FBF2'
const AMBAR = '#F59E0B'
const AMBAR_SUAVE = '#FEF3E2'
const ROJO = '#EF4444'
const ROJO_SUAVE = '#FEF2F2'
const GRIS = '#64748B'
const GRIS_CLARO = '#94A3B8'
const BORDE = '#E2E8F0'

const CONSISTENCIA_COLORS: Record<Consistencia, string> = {
  normal: VERDE,
  blanda: AMBAR,
  dura: AMBAR,
  diarrea: ROJO,
}

const CONSISTENCIA_SUAVE: Record<Consistencia, string> = {
  normal: VERDE_SUAVE,
  blanda: AMBAR_SUAVE,
  dura: AMBAR_SUAVE,
  diarrea: ROJO_SUAVE,
}

function toDateInputValue(fecha: Date) {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function esMismoDia(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

export default function BitacoraEvacuacionesPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const pacienteId = params.id as string

  const [rol, setRol] = useState<string | null>(null)
  const [paciente, setPaciente] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [vista, setVista] = useState<'hoy' | 'historial'>('hoy')

  const [registros30, setRegistros30] = useState<Registro[]>([])

  const [galeria, setGaleria] = useState<Registro[]>([])
  const [galeriaOffset, setGaleriaOffset] = useState(0)
  const [galeriaHasMore, setGaleriaHasMore] = useState(true)
  const [cargandoGaleria, setCargandoGaleria] = useState(false)
  const GALERIA_PAGE = 30

  const [listaTexto, setListaTexto] = useState<Registro[]>([])
  const [listaTextoOffset, setListaTextoOffset] = useState(0)
  const [listaTextoHasMore, setListaTextoHasMore] = useState(true)
  const [cargandoListaTexto, setCargandoListaTexto] = useState(false)
  const LISTA_PAGE = 20

  const [modalAbierto, setModalAbierto] = useState(false)
  const [fechaModal, setFechaModal] = useState(new Date())
  const [hora, setHora] = useState('')
  const [consistencia, setConsistencia] = useState<Consistencia>('normal')
  const [nota, setNota] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [previewFoto, setPreviewFoto] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [fotoVisor, setFotoVisor] = useState<Registro | null>(null)
  const [urlVisor, setUrlVisor] = useState('')

  const esFamilia = rol === 'familia'
  const hoy = new Date()

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: userData } = await supabase
        .from('users').select('role').eq('id', user.id).single()
      setRol(userData?.role ?? null)

      const { data: pacienteData } = await supabase
        .from('pacientes').select('nombre').eq('id', pacienteId).single()
      setPaciente(pacienteData)

      await cargarRegistros30()
      await cargarGaleria(true)
      await cargarListaTexto(true)
      setLoading(false)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarListaTexto(reset = false) {
    setCargandoListaTexto(true)
    const offset = reset ? 0 : listaTextoOffset

    const { data } = await supabase
      .from('bitacora_registros')
      .select('id, hora_inicio, consistencia, foto_url, nota, registrado_por')
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'evacuacion')
      .is('foto_url', null)
      .is('deleted_at', null)
      .order('hora_inicio', { ascending: false })
      .range(offset, offset + LISTA_PAGE - 1)

    const nuevos = data ?? []
    setListaTexto(prev => reset ? nuevos : [...prev, ...nuevos])
    setListaTextoOffset(offset + nuevos.length)
    setListaTextoHasMore(nuevos.length === LISTA_PAGE)
    setCargandoListaTexto(false)
  }

  async function cargarRegistros30() {
    const desde = new Date()
    desde.setDate(desde.getDate() - 29)
    desde.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('bitacora_registros')
      .select('id, hora_inicio, consistencia, foto_url, nota, registrado_por')
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'evacuacion')
      .gte('hora_inicio', desde.toISOString())
      .is('deleted_at', null)
      .order('hora_inicio', { ascending: true })

    setRegistros30(data ?? [])
  }

  async function cargarGaleria(reset = false) {
    setCargandoGaleria(true)
    const offset = reset ? 0 : galeriaOffset

    const { data } = await supabase
      .from('bitacora_registros')
      .select('id, hora_inicio, consistencia, foto_url, nota, registrado_por')
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'evacuacion')
      .not('foto_url', 'is', null)
      .is('deleted_at', null)
      .order('hora_inicio', { ascending: false })
      .range(offset, offset + GALERIA_PAGE - 1)

    const nuevos = data ?? []
    setGaleria(prev => reset ? nuevos : [...prev, ...nuevos])
    setGaleriaOffset(offset + nuevos.length)
    setGaleriaHasMore(nuevos.length === GALERIA_PAGE)
    setCargandoGaleria(false)
  }

  // --- Agregados para Historial (últimos 30 días) ---
  const diasAgregados = useMemo(() => {
    const dias: { fecha: Date; veces: number; tipo: Consistencia | null; fotoRegistro: Registro | null }[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      dias.push({ fecha: d, veces: 0, tipo: null, fotoRegistro: null })
    }
    const PRIORIDAD: Consistencia[] = ['diarrea', 'blanda', 'dura', 'normal']

    registros30.forEach(r => {
      const fechaR = new Date(r.hora_inicio)
      fechaR.setHours(0, 0, 0, 0)
      const dia = dias.find(d => esMismoDia(d.fecha, fechaR))
      if (!dia) return
      dia.veces++
      if (r.consistencia) {
        if (!dia.tipo || PRIORIDAD.indexOf(r.consistencia) < PRIORIDAD.indexOf(dia.tipo)) {
          dia.tipo = r.consistencia
        }
      }
      if (r.foto_url && !dia.fotoRegistro) {
        dia.fotoRegistro = r
      }
    })
    return dias
  }, [registros30])

  const statsHistorial = useMemo(() => {
    const totalVeces = diasAgregados.reduce((acc, d) => acc + d.veces, 0)
    const diasSinEvacuar = diasAgregados.filter(d => d.veces === 0).length
    const diasConDiarrea = diasAgregados.filter(d => d.tipo === 'diarrea').length
    const promedio = (totalVeces / 30).toFixed(1)
    return { promedio, diasSinEvacuar, diasConDiarrea }
  }, [diasAgregados])

  const diasSinRegistroSeguidos = useMemo(() => {
    let racha = 0
    for (let i = diasAgregados.length - 1; i >= 0; i--) {
      const dia = diasAgregados[i]
      const esHoyDia = esMismoDia(dia.fecha, new Date())
      if (esHoyDia) continue // no contamos el día de hoy si aún no termina
      if (dia.veces > 0) break
      racha++
    }
    return racha
  }, [diasAgregados])

  function abrirModalNuevo() {
    const ahora = new Date()
    setHora(`${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`)
    setFechaModal(new Date())
    setConsistencia('normal')
    setNota('')
    setFoto(null)
    setPreviewFoto(null)
    setError('')
    setModalAbierto(true)
  }

  function seleccionarFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFoto(file)
    setPreviewFoto(URL.createObjectURL(file))
  }

  async function guardarRegistro() {
    if (!hora) {
      setError('Selecciona la hora.')
      return
    }
    setGuardando(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const [h, m] = hora.split(':').map(Number)
    const fechaHora = new Date(fechaModal)
    fechaHora.setHours(h, m, 0, 0)

    let fotoPath: string | null = null
    if (foto) {
      const ext = foto.name.split('.').pop()
      fotoPath = `${pacienteId}/bitacora/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fotoPath, foto)
      if (uploadError) {
        setError('Error al subir la foto. Intenta de nuevo.')
        setGuardando(false)
        return
      }
    }

    const { error: dbError } = await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: 'evacuacion',
      hora_inicio: fechaHora.toISOString(),
      consistencia,
      foto_url: fotoPath,
      nota: nota || null,
      registrado_por: user!.id,
    })

    if (dbError) {
      setError('Error al guardar el registro.')
      setGuardando(false)
      return
    }

    setModalAbierto(false)
    await cargarRegistros30()
    await cargarGaleria(true)
    await cargarListaTexto(true)
    setGuardando(false)
  }

  async function eliminarRegistro(registro: Registro) {
    if (!confirm('¿Eliminar este registro?')) return
    // NOM-004/024: nunca DELETE físico. Se marca deleted_at; la foto se conserva
    // en storage como parte del rastro de auditoría.
    await supabase
      .from('bitacora_registros')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', registro.id)
    await cargarRegistros30()
    await cargarGaleria(true)
    await cargarListaTexto(true)
  }

  async function abrirFoto(registro: Registro) {
    if (!registro.foto_url) return
    const { data } = await supabase.storage
      .from('documentos')
      .createSignedUrl(registro.foto_url, 60)
    if (data?.signedUrl) {
      setFotoVisor(registro)
      setUrlVisor(data.signedUrl)
    }
  }

  function formatHora(iso: string) {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
  }

  function formatFechaHora(iso: string) {
    const d = new Date(iso)
    const fechaTxt = esMismoDia(d, hoy)
      ? 'Hoy'
      : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
    return `${fechaTxt}, ${d.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}`
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: '#F8FAFC' }}>
        <p className="text-gray-400">Cargando...</p>
      </main>
    )
  }

  const maxVeces = Math.max(3, ...diasAgregados.map(d => d.veces))

  return (
    <main className="min-h-screen pb-10" style={{ background: '#F8FAFC', fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* Nav */}
        <div className="flex items-center justify-between mb-5">
          <Link href="/dashboard" className="flex items-center gap-2 no-underline">
            <div
              className="w-[26px] h-[26px] rounded-lg flex items-center justify-center text-white text-xs font-extrabold"
              style={{ background: AZUL, fontFamily: "'Sora', sans-serif" }}
            >
              S
            </div>
            <div className="font-bold text-base" style={{ fontFamily: "'Sora', sans-serif" }}>
              Syncro<span style={{ color: AZUL }}>Medic</span>
            </div>
          </Link>
          <Link href={`/paciente/${pacienteId}`} className="text-[13px]" style={{ color: GRIS }}>
            ← Volver al expediente
          </Link>
        </div>

        {/* Selector de vista */}
        <div className="flex rounded-xl p-[3px] mb-5" style={{ background: '#F1F5F9' }}>
          <button
            onClick={() => setVista('hoy')}
            className="flex-1 text-center text-[12.5px] font-bold py-2.5 rounded-lg"
            style={vista === 'hoy' ? { background: 'white', color: VERDE, boxShadow: '0 1px 3px rgba(15,23,42,0.08)' } : { color: GRIS }}
          >
            Hoy
          </button>
          <button
            onClick={() => setVista('historial')}
            className="flex-1 text-center text-[12.5px] font-bold py-2.5 rounded-lg"
            style={vista === 'historial' ? { background: 'white', color: VERDE, boxShadow: '0 1px 3px rgba(15,23,42,0.08)' } : { color: GRIS }}
          >
            Historial
          </button>
        </div>

        {vista === 'hoy' ? (
          <>
            {/* Encabezado */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-lg" style={{ background: VERDE_SUAVE }}>
                💧
              </div>
              <div>
                <h1 className="text-[21px] font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>Evacuaciones</h1>
                <p className="text-[13px]" style={{ color: GRIS }}>{paciente?.nombre} · registro diario</p>
              </div>
            </div>

            {diasSinRegistroSeguidos >= 3 && (
              <div className="rounded-xl px-4 py-3 mb-4 text-sm" style={{ background: ROJO_SUAVE, color: '#B91C1C', border: `1px solid #FCA5A5` }}>
                ⚠️ {diasSinRegistroSeguidos} días sin registro de evacuaciones. Si esto no es normal para {paciente?.nombre}, consideren consultar al médico.
              </div>
            )}

            {/* Galería global de fotos (todo el historial, más reciente primero) */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] font-bold uppercase" style={{ color: GRIS_CLARO, letterSpacing: '0.06em' }}>
                  Galería
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {esFamilia && (
                  <button
                    onClick={abrirModalNuevo}
                    className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
                    style={{ background: 'white', border: `1.5px dashed #CBD5E1`, color: GRIS_CLARO }}
                  >
                    <span className="text-xl">📷</span>
                    <p className="text-[9.5px] font-semibold text-center px-1">Agregar foto</p>
                  </button>
                )}
                {galeria.map(r => (
                  <RegistroFotoThumb
                    key={r.id}
                    registro={r}
                    supabase={supabase}
                    onClick={() => abrirFoto(r)}
                    formatHora={formatHora}
                  />
                ))}
              </div>
              {galeria.length === 0 && (
                <div className="rounded-2xl px-4 py-8 text-center mt-2" style={{ background: 'white', border: `1px solid ${BORDE}`, color: GRIS_CLARO }}>
                  Aún no hay fotos registradas.
                </div>
              )}
              {galeriaHasMore && galeria.length > 0 && (
                <button
                  onClick={() => cargarGaleria(false)}
                  disabled={cargandoGaleria}
                  className="w-full text-center text-[12.5px] font-semibold py-3 mt-3 rounded-xl"
                  style={{ background: 'white', border: `1px solid ${BORDE}`, color: AZUL }}
                >
                  {cargandoGaleria ? 'Cargando...' : 'Cargar más'}
                </button>
              )}
            </div>

            {/* Registros sin foto (feed global, más reciente primero) */}
            <div className="mb-2">
              <span className="text-[11px] font-bold uppercase" style={{ color: GRIS_CLARO, letterSpacing: '0.06em' }}>
                Registros sin foto
              </span>
            </div>

            {listaTexto.length === 0 ? (
              <div className="rounded-2xl px-4 py-8 text-center" style={{ background: 'white', border: `1px solid ${BORDE}`, color: GRIS_CLARO }}>
                Sin registros todavía.
              </div>
            ) : (
              <div className="rounded-2xl px-[18px] pt-[18px] pb-2" style={{ background: 'white', border: `1px solid ${BORDE}`, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
                {listaTexto.map((r, i) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2.5 py-3 text-[13px]"
                    style={i > 0 ? { borderTop: '1px solid #F1F5F9' } : {}}
                  >
                    <div className="font-bold text-[12.5px] w-[75px] flex-shrink-0" style={{ fontFamily: "'Sora', sans-serif" }}>
                      {formatFechaHora(r.hora_inicio)}
                    </div>
                    <div className="flex-1" style={{ color: GRIS }}>{r.nota || '—'}</div>
                    {r.consistencia && (
                      <span
                        className="text-[10.5px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
                        style={{ background: CONSISTENCIA_SUAVE[r.consistencia], color: CONSISTENCIA_COLORS[r.consistencia] }}
                      >
                        {CONSISTENCIA_LABELS[r.consistencia]}
                      </span>
                    )}
                    {esFamilia && (
                      <button onClick={() => eliminarRegistro(r)} className="text-sm flex-shrink-0" style={{ color: '#CBD5E1' }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {listaTextoHasMore && listaTexto.length > 0 && (
              <button
                onClick={() => cargarListaTexto(false)}
                disabled={cargandoListaTexto}
                className="w-full text-center text-[12.5px] font-semibold py-3 mt-3 rounded-xl"
                style={{ background: 'white', border: `1px solid ${BORDE}`, color: AZUL }}
              >
                {cargandoListaTexto ? 'Cargando...' : 'Cargar más'}
              </button>
            )}

            {esFamilia && (
              <button
                onClick={abrirModalNuevo}
                className="w-full text-white font-bold text-sm py-3.5 rounded-2xl mt-5"
                style={{ background: VERDE }}
              >
                + Agregar registro (con o sin foto)
              </button>
            )}
          </>
        ) : (
          <>
            {/* Historial */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center text-lg" style={{ background: VERDE_SUAVE }}>
                💧
              </div>
              <div>
                <h1 className="text-[21px] font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>Historial de evacuaciones</h1>
                <p className="text-[13px]" style={{ color: GRIS }}>{paciente?.nombre} · últimos 30 días</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-4">
              <div className="rounded-2xl px-3 py-3.5" style={{ background: 'white', border: `1px solid ${BORDE}` }}>
                <div className="text-lg font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>{statsHistorial.promedio}</div>
                <div className="text-[10.5px] mt-0.5 leading-tight" style={{ color: GRIS }}>Veces al día (promedio)</div>
              </div>
              <div className="rounded-2xl px-3 py-3.5" style={{ background: 'white', border: `1px solid ${BORDE}` }}>
                <div className="text-lg font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>{statsHistorial.diasSinEvacuar}</div>
                <div className="text-[10.5px] mt-0.5 leading-tight" style={{ color: GRIS }}>Días sin evacuar</div>
              </div>
              <div className="rounded-2xl px-3 py-3.5" style={{ background: 'white', border: `1px solid ${BORDE}` }}>
                <div className="text-lg font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>{statsHistorial.diasConDiarrea}</div>
                <div className="text-[10.5px] mt-0.5 leading-tight" style={{ color: GRIS }}>Días con diarrea</div>
              </div>
            </div>

            <div className="rounded-2xl p-[18px]" style={{ background: 'white', border: `1px solid ${BORDE}`, boxShadow: '0 1px 3px rgba(15,23,42,0.04)' }}>
              <h2 className="text-[14.5px] font-bold" style={{ fontFamily: "'Sora', sans-serif" }}>Veces al día · últimos 30 días</h2>
              <p className="text-[12px] mt-0.5" style={{ color: GRIS }}>
                Cada barra es un día. El círculo rojo abajo marca un día sin ninguna evacuación registrada.
              </p>

              <div className="flex items-end gap-[3px] mt-5" style={{ height: '130px' }}>
                {diasAgregados.map((d, i) => {
                  const alturaPct = d.veces > 0 ? Math.max(8, (d.veces / maxVeces) * 100) : 3
                  const color = d.veces === 0 ? '#F1F5F9' : (d.tipo ? CONSISTENCIA_COLORS[d.tipo] : VERDE)
                  const etiquetaDia = `Hace ${29 - i} día${29 - i === 1 ? '' : 's'}`
                  const tieneFoto = !!d.fotoRegistro
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!tieneFoto}
                      onClick={() => d.fotoRegistro && abrirFoto(d.fotoRegistro)}
                      className={`flex-1 flex flex-col items-center justify-end h-full min-w-[5px] ${tieneFoto ? 'cursor-pointer hover:opacity-70' : 'cursor-default'} transition-opacity`}
                      title={`${etiquetaDia} · ${d.veces} ${d.veces === 1 ? 'vez' : 'veces'}${d.tipo ? ' · ' + CONSISTENCIA_LABELS[d.tipo] : ''}${tieneFoto ? ' · con foto' : ''}`}
                    >
                      {tieneFoto && (
                        <span className="text-[8px] leading-none mb-1">📷</span>
                      )}
                      {d.veces === 0 && (
                        <div
                          className="w-[7px] h-[7px] rounded-full mb-0.5"
                          style={{ background: '#FCA5A5', border: `1.5px solid ${ROJO}` }}
                          title={`${etiquetaDia} · sin evacuación`}
                        />
                      )}
                      <div
                        className="w-full rounded-t-sm"
                        style={{ maxWidth: '9px', height: `${alturaPct}%`, background: color }}
                      />
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-between mt-1.5 text-[10px]" style={{ color: GRIS_CLARO }}>
                <span>Hace 30 días</span>
                <span>Hoy</span>
              </div>

              <div className="flex items-center gap-3.5 flex-wrap mt-3.5 text-[10.5px]" style={{ color: GRIS_CLARO }}>
                <span><span className="inline-block w-[9px] h-[9px] rounded-[3px] mr-1" style={{ background: VERDE }} />Normal</span>
                <span><span className="inline-block w-[9px] h-[9px] rounded-[3px] mr-1" style={{ background: AMBAR }} />Blanda/Dura</span>
                <span><span className="inline-block w-[9px] h-[9px] rounded-[3px] mr-1" style={{ background: ROJO }} />Diarrea</span>
                <span><span className="inline-block w-[9px] h-[9px] rounded-full mr-1" style={{ background: '#FCA5A5', border: `1.5px solid ${ROJO}` }} />Sin evacuación</span>
                <span>📷 Con foto</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal nuevo registro */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4" style={{ fontFamily: "'Sora', sans-serif" }}>Nuevo registro</h3>

            <label className="block text-sm mb-1" style={{ color: GRIS }}>Fecha</label>
            <input
              type="date"
              value={toDateInputValue(fechaModal)}
              max={toDateInputValue(hoy)}
              onChange={(e) => setFechaModal(new Date(e.target.value + 'T12:00:00'))}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />

            <label className="block text-sm mb-1" style={{ color: GRIS }}>Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />

            <label className="block text-sm mb-1" style={{ color: GRIS }}>Consistencia</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {(Object.keys(CONSISTENCIA_LABELS) as Consistencia[]).map(c => (
                <button
                  key={c}
                  onClick={() => setConsistencia(c)}
                  className="px-3 py-1.5 rounded-full text-sm border"
                  style={
                    consistencia === c
                      ? { backgroundColor: CONSISTENCIA_COLORS[c], color: 'white', borderColor: CONSISTENCIA_COLORS[c] }
                      : { borderColor: BORDE, color: GRIS }
                  }
                >
                  {CONSISTENCIA_LABELS[c]}
                </button>
              ))}
            </div>

            <label className="block text-sm mb-1" style={{ color: GRIS }}>Foto (opcional)</label>
            <input type="file" accept="image/*" onChange={seleccionarFoto} className="mb-2 text-sm" />
            {previewFoto && (
              <img src={previewFoto} alt="Previsualización" className="w-24 h-24 object-cover rounded-lg mb-4" />
            )}

            <label className="block text-sm mb-1" style={{ color: GRIS }}>Nota (opcional)</label>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
              rows={2}
            />

            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => setModalAbierto(false)}
                className="flex-1 py-2 rounded-lg border"
                style={{ color: GRIS }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarRegistro}
                disabled={guardando}
                className="flex-1 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ background: VERDE }}
              >
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor de foto ampliada */}
      {fotoVisor && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6"
          onClick={() => setFotoVisor(null)}
        >
          <div className="bg-white rounded-2xl overflow-hidden max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <img src={urlVisor} alt="Registro" className="w-full max-h-96 object-contain bg-black" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[15px]" style={{ fontFamily: "'Sora', sans-serif" }}>{formatHora(fotoVisor.hora_inicio)}</span>
                {fotoVisor.consistencia && (
                  <span
                    className="text-[10.5px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: CONSISTENCIA_SUAVE[fotoVisor.consistencia], color: CONSISTENCIA_COLORS[fotoVisor.consistencia] }}
                  >
                    {CONSISTENCIA_LABELS[fotoVisor.consistencia]}
                  </span>
                )}
              </div>
              {fotoVisor.nota && <p className="text-[13px]" style={{ color: GRIS }}>{fotoVisor.nota}</p>}
              <div className="text-center mt-3.5">
                <button
                  onClick={() => setFotoVisor(null)}
                  className="text-[12.5px] font-semibold px-5 py-2 rounded-lg"
                  style={{ background: '#F1F5F9', color: GRIS }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function RegistroFotoThumb({
  registro,
  supabase,
  onClick,
  formatHora,
}: {
  registro: Registro
  supabase: any
  onClick: () => void
  formatHora: (iso: string) => string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const color = registro.consistencia ? CONSISTENCIA_COLORS[registro.consistencia] : '#94A3B8'

  useEffect(() => {
    async function cargar() {
      const { data } = await supabase.storage
        .from('documentos')
        .createSignedUrl(registro.foto_url!, 300)
      if (data?.signedUrl) setUrl(data.signedUrl)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro.foto_url])

  return (
    <button
      onClick={onClick}
      className="relative aspect-square rounded-xl overflow-hidden"
      style={{ background: '#F1F5F9', border: `2px solid ${color}` }}
    >
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
      <span
        className="absolute top-[5px] right-[5px] text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(15,23,42,0.5)' }}
      >
        {formatHora(registro.hora_inicio)}
      </span>
      {registro.consistencia && (
        <span
          className="absolute bottom-[5px] left-[5px] text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.92)', color }}
        >
          {CONSISTENCIA_LABELS[registro.consistencia]}
        </span>
      )}
    </button>
  )
}