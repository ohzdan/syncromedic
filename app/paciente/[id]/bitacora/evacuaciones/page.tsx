'use client'

import { useEffect, useState, useRef } from 'react'
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

const CONSISTENCIA_COLORS: Record<Consistencia, string> = {
  normal: '#00C97A',
  blanda: '#1A6BFF',
  dura: '#F59E0B',
  diarrea: '#EF4444',
}

function formatFechaCorta(fecha: Date) {
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

function toDateInputValue(fecha: Date) {
  const y = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function BitacoraEvacuacionesPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const pacienteId = params.id as string

  const [rol, setRol] = useState<string | null>(null)
  const [paciente, setPaciente] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date())
  const [registros, setRegistros] = useState<Registro[]>([])
  const [diasSinRegistro, setDiasSinRegistro] = useState(0)

  const [modalAbierto, setModalAbierto] = useState(false)
  const [hora, setHora] = useState('')
  const [consistencia, setConsistencia] = useState<Consistencia>('normal')
  const [nota, setNota] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [previewFoto, setPreviewFoto] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [fotoVisor, setFotoVisor] = useState<Registro | null>(null)
  const [urlVisor, setUrlVisor] = useState('')

  const fechaInputRef = useRef<HTMLInputElement>(null)
  const esFamilia = rol === 'familia'

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

      await cargarRegistrosDelDia(fechaSeleccionada)
      await calcularDiasSinRegistro()
      setLoading(false)
    }
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    cargarRegistrosDelDia(fechaSeleccionada)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaSeleccionada])

  async function cargarRegistrosDelDia(fecha: Date) {
    const inicio = new Date(fecha)
    inicio.setHours(0, 0, 0, 0)
    const fin = new Date(fecha)
    fin.setHours(23, 59, 59, 999)

    const { data } = await supabase
      .from('bitacora_registros')
      .select('id, hora_inicio, consistencia, foto_url, nota, registrado_por')
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'evacuacion')
      .gte('hora_inicio', inicio.toISOString())
      .lte('hora_inicio', fin.toISOString())
      .order('hora_inicio', { ascending: false })

    setRegistros(data ?? [])
  }

  async function calcularDiasSinRegistro() {
    const desde = new Date()
    desde.setDate(desde.getDate() - 14)
    desde.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('bitacora_registros')
      .select('hora_inicio')
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'evacuacion')
      .gte('hora_inicio', desde.toISOString())
      .order('hora_inicio', { ascending: false })

    const diasConRegistro = new Set(
      (data ?? []).map((r: { hora_inicio: string }) => new Date(r.hora_inicio).toDateString())
    )

    let racha = 0
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const hoyClave = new Date().toDateString()
    let vueltas = 0
    while (vueltas < 14) {
      const clave = cursor.toDateString()
      if (clave === hoyClave) {
        cursor.setDate(cursor.getDate() - 1)
        vueltas++
        continue
      }
      if (diasConRegistro.has(clave)) break
      racha++
      cursor.setDate(cursor.getDate() - 1)
      vueltas++
    }
    setDiasSinRegistro(racha)
  }

  function cambiarDia(delta: number) {
    const nueva = new Date(fechaSeleccionada)
    nueva.setDate(nueva.getDate() + delta)
    setFechaSeleccionada(nueva)
  }

  function irAHoy() {
    setFechaSeleccionada(new Date())
  }

  function abrirModalNuevo() {
    const ahora = new Date()
    setHora(`${String(ahora.getHours()).padStart(2, '0')}:${String(ahora.getMinutes()).padStart(2, '0')}`)
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
    const fechaHora = new Date(fechaSeleccionada)
    fechaHora.setHours(h, m, 0, 0)

    let fotoPath: string | null = null
    if (foto) {
      const ext = foto.name.split('.').pop()
      fotoPath = `bitacora/${pacienteId}/${Date.now()}.${ext}`
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
    await cargarRegistrosDelDia(fechaSeleccionada)
    await calcularDiasSinRegistro()
    setGuardando(false)
  }

  async function eliminarRegistro(registro: Registro) {
    if (!confirm('¿Eliminar este registro?')) return
    if (registro.foto_url) {
      await supabase.storage.from('documentos').remove([registro.foto_url])
    }
    await supabase.from('bitacora_registros').delete().eq('id', registro.id)
    await cargarRegistrosDelDia(fechaSeleccionada)
    await calcularDiasSinRegistro()
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
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F9FC] flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </main>
    )
  }

  const conFoto = registros.filter(r => r.foto_url)
  const sinFoto = registros.filter(r => !r.foto_url)
  const esHoy = fechaSeleccionada.toDateString() === new Date().toDateString()

  return (
    <main className="min-h-screen bg-[#F7F9FC] pb-24">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <Link href={`/paciente/${pacienteId}`} className="text-sm text-gray-500 hover:text-[#1A6BFF]">
          ← Volver al expediente
        </Link>

        <h1 className="text-2xl font-bold mt-2" style={{ fontFamily: 'Sora, sans-serif' }}>
          Evacuaciones
        </h1>
        <p className="text-gray-500 text-sm mb-4">{paciente?.nombre}</p>

        {diasSinRegistro >= 3 && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
            ⚠️ {diasSinRegistro} días sin registro de evacuaciones. Si esto no es normal para {paciente?.nombre}, consideren consultar al médico.
          </div>
        )}

        {/* Navegador de fecha */}
        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 mb-4 shadow-sm">
          <button onClick={() => cambiarDia(-1)} className="text-gray-400 hover:text-[#1A6BFF] px-2">‹</button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fechaInputRef.current?.showPicker?.() ?? fechaInputRef.current?.click()}
              className="font-medium text-gray-800"
            >
              {esHoy ? 'Hoy' : formatFechaCorta(fechaSeleccionada)}
            </button>
            <input
              ref={fechaInputRef}
              type="date"
              className="sr-only"
              value={toDateInputValue(fechaSeleccionada)}
              onChange={(e) => setFechaSeleccionada(new Date(e.target.value + 'T12:00:00'))}
            />
            {!esHoy && (
              <button onClick={irAHoy} className="text-xs text-[#1A6BFF] underline">Volver a hoy</button>
            )}
          </div>
          <button onClick={() => cambiarDia(1)} className="text-gray-400 hover:text-[#1A6BFF] px-2">›</button>
        </div>

        {/* Galería con foto */}
        {conFoto.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Con foto</h2>
            <div className="grid grid-cols-3 gap-2">
              {conFoto.map(r => (
                <RegistroFotoThumb key={r.id} registro={r} supabase={supabase} onClick={() => abrirFoto(r)} />
              ))}
            </div>
          </div>
        )}

        {/* Lista sin foto */}
        {sinFoto.length > 0 && (
          <div className="mb-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Sin foto</h2>
            <div className="space-y-2">
              {sinFoto.map(r => (
                <div key={r.id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center justify-between">
                  <div>
                    <span className="font-medium">{formatHora(r.hora_inicio)}</span>
                    {r.consistencia && (
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: CONSISTENCIA_COLORS[r.consistencia] }}
                      >
                        {CONSISTENCIA_LABELS[r.consistencia]}
                      </span>
                    )}
                    {r.nota && <p className="text-sm text-gray-500 mt-1">{r.nota}</p>}
                  </div>
                  {esFamilia && (
                    <button onClick={() => eliminarRegistro(r)} className="text-gray-300 hover:text-red-500 text-sm">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {registros.length === 0 && (
          <div className="bg-white rounded-xl px-4 py-8 text-center text-gray-400 shadow-sm">
            Sin registros este día.
          </div>
        )}
      </div>

      {esFamilia && (
        <button
          onClick={abrirModalNuevo}
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-[#1A6BFF] text-white text-2xl shadow-lg flex items-center justify-center"
        >
          +
        </button>
      )}

      {/* Modal nuevo registro */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6">
            <h3 className="font-bold text-lg mb-4">Nuevo registro</h3>

            <label className="block text-sm text-gray-500 mb-1">Hora</label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mb-4"
            />

            <label className="block text-sm text-gray-500 mb-1">Consistencia</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {(Object.keys(CONSISTENCIA_LABELS) as Consistencia[]).map(c => (
                <button
                  key={c}
                  onClick={() => setConsistencia(c)}
                  className="px-3 py-1.5 rounded-full text-sm border"
                  style={
                    consistencia === c
                      ? { backgroundColor: CONSISTENCIA_COLORS[c], color: 'white', borderColor: CONSISTENCIA_COLORS[c] }
                      : { borderColor: '#E5E7EB', color: '#6B7280' }
                  }
                >
                  {CONSISTENCIA_LABELS[c]}
                </button>
              ))}
            </div>

            <label className="block text-sm text-gray-500 mb-1">Foto (opcional)</label>
            <input type="file" accept="image/*" onChange={seleccionarFoto} className="mb-2 text-sm" />
            {previewFoto && (
              <img src={previewFoto} alt="Previsualización" className="w-24 h-24 object-cover rounded-lg mb-4" />
            )}

            <label className="block text-sm text-gray-500 mb-1">Nota (opcional)</label>
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
                className="flex-1 py-2 rounded-lg border text-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={guardarRegistro}
                disabled={guardando}
                className="flex-1 py-2 rounded-lg bg-[#1A6BFF] text-white disabled:opacity-50"
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
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setFotoVisor(null)}
        >
          <div className="bg-white rounded-2xl overflow-hidden max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <img src={urlVisor} alt="Registro" className="w-full max-h-96 object-contain bg-black" />
            <div className="p-4">
              <p className="font-medium">{formatHora(fotoVisor.hora_inicio)}</p>
              {fotoVisor.consistencia && (
                <span
                  className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: CONSISTENCIA_COLORS[fotoVisor.consistencia] }}
                >
                  {CONSISTENCIA_LABELS[fotoVisor.consistencia]}
                </span>
              )}
              {fotoVisor.nota && <p className="text-sm text-gray-500 mt-2">{fotoVisor.nota}</p>}
              <button onClick={() => setFotoVisor(null)} className="mt-4 text-sm text-gray-400">Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function RegistroFotoThumb({ registro, supabase, onClick }: { registro: Registro, supabase: any, onClick: () => void }) {
  const [url, setUrl] = useState<string | null>(null)

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
    <button onClick={onClick} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
      {url && <img src={url} alt="" className="w-full h-full object-cover" />}
      <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
        {new Date(registro.hora_inicio).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
      </span>
      {registro.consistencia && (
        <span
          className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full text-white"
          style={{ backgroundColor: CONSISTENCIA_COLORS[registro.consistencia] }}
        >
          {CONSISTENCIA_LABELS[registro.consistencia]}
        </span>
      )}
    </button>
  )
}