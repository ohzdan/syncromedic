"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

type TipoDatoCampo = 'escala_1_5' | 'numero' | 'hora_unica' | 'rango_horas' | 'si_no' | 'texto_corto';

type CampoPaciente = {
  id: string;
  nombre: string;
  tipo_dato: TipoDatoCampo;
  permite_foto: boolean;
  icono: string | null;
};

type Registro = {
  id: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  valor_numero: number | null;
  valor_texto: string | null;
  valor_booleano: boolean | null;
  foto_url: string | null;
  nota: string | null;
};

function hoyISO() { return new Date().toISOString().split('T')[0]; }

function horaHHMM(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function localToUTCISO(fechaISO: string, horaHHMM_: string) {
  const [h, m] = horaHHMM_.split(':').map(Number);
  const d = new Date(fechaISO + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

/** Si la hora de fin es "menor" que la de inicio en el reloj, asume que cruzó a la madrugada del día siguiente. */
function horaFinAjustada(fechaBase: string, horaInicio: string, horaFin: string) {
  const fechaReal = horaFin < horaInicio ? sumarDias(fechaBase, 1) : fechaBase;
  return localToUTCISO(fechaReal, horaFin);
}

function sumarDias(fechaISO: string, dias: number) {
  const d = new Date(fechaISO + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

function formatFechaCorta(fechaISO: string) {
  return new Date(fechaISO + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function formatDuracion(inicioISO: string, finISO: string) {
  const ms = new Date(finISO).getTime() - new Date(inicioISO).getTime();
  if (ms <= 0) return "—";
  const horas = Math.floor(ms / 3600000);
  const minutos = Math.round((ms % 3600000) / 60000);
  return `${horas}h ${minutos}m`;
}

export default function DetalleCampoDinamico() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const pacienteId = params.id as string;
  const campoId = params.campoId as string;
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const [campo, setCampo] = useState<CampoPaciente | null>(null);
  const [nombreParaEquipo, setNombreParaEquipo] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [rol, setRol] = useState<string>('familia');

  const [formAbierto, setFormAbierto] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [horaInicio, setHoraInicio] = useState('12:00');
  const [horaFin, setHoraFin] = useState('12:30');
  const [valorNumero, setValorNumero] = useState<number>(3);
  const [valorTexto, setValorTexto] = useState('');
  const [valorBooleano, setValorBooleano] = useState<boolean | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    setRol(userData?.role || user.user_metadata?.role || 'familia');

    const { data: pac } = await supabase.from('pacientes').select('nombre, apodo').eq('id', pacienteId).single();
    if (!pac) { router.push('/dashboard'); return; }
    setNombreParaEquipo(pac.apodo || pac.nombre);

    const { data: campoData } = await supabase
      .from('bitacora_campos_paciente')
      .select('id, nombre, tipo_dato, permite_foto, icono')
      .eq('id', campoId)
      .single();

    if (!campoData) { router.push(`/paciente/${pacienteId}/bitacora`); return; }
    setCampo(campoData as CampoPaciente);

    const { data: regs } = await supabase
      .from('bitacora_registros_generico')
      .select('id, fecha, hora_inicio, hora_fin, valor_numero, valor_texto, valor_booleano, foto_url, nota')
      .eq('campo_paciente_id', campoId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false });

    setRegistros((regs || []) as Registro[]);
    setCargando(false);
  }

  function limpiarFormulario() {
    setFecha(hoyISO()); setHoraInicio('12:00'); setHoraFin('12:30');
    setValorNumero(3); setValorTexto(''); setValorBooleano(null);
    setFoto(null); setPreviewFoto(null); setNota(''); setError('');
  }

  function onFotoSeleccionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    setPreviewFoto(URL.createObjectURL(file));
  }

  async function guardarRegistro() {
    if (!campo) return;
    setError('');

    if (campo.tipo_dato === 'si_no' && valorBooleano === null) { setError('Elige Sí o No.'); return; }
    if (campo.tipo_dato === 'texto_corto' && !valorTexto.trim()) { setError('Escribe algo.'); return; }

    setGuardando(true);

    let horaInicioISO: string | null = null;
    let horaFinISO: string | null = null;

    if (campo.tipo_dato === 'hora_unica') {
      horaInicioISO = localToUTCISO(fecha, horaInicio);
    } else if (campo.tipo_dato === 'rango_horas') {
      horaInicioISO = localToUTCISO(fecha, horaInicio);
      horaFinISO = horaFinAjustada(fecha, horaInicio, horaFin);
    }

    let fotoPath: string | null = null;
    if (campo.permite_foto && foto) {
      const ext = foto.name.split('.').pop();
      fotoPath = `${pacienteId}/bitacora-generico/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('documentos').upload(fotoPath, foto);
      if (uploadError) setError('El registro se guardó, pero la foto no se pudo subir.');
    }

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error: dbError } = await supabase.from('bitacora_registros_generico').insert({
      paciente_id: pacienteId,
      campo_paciente_id: campoId,
      fecha,
      hora_inicio: horaInicioISO,
      hora_fin: horaFinISO,
      valor_numero: (campo.tipo_dato === 'escala_1_5' || campo.tipo_dato === 'numero') ? valorNumero : null,
      valor_texto: campo.tipo_dato === 'texto_corto' ? valorTexto.trim() : null,
      valor_booleano: campo.tipo_dato === 'si_no' ? valorBooleano : null,
      foto_url: fotoPath,
      nota: nota.trim() || null,
      registrado_por: user?.id,
    }).select().single();

    if (dbError || !data) {
      setError('No se pudo guardar. Intenta de nuevo.');
      setGuardando(false);
      return;
    }

    setRegistros(prev => [data as Registro, ...prev]);
    setFormAbierto(false);
    limpiarFormulario();
    setGuardando(false);
  }

  function formatValorRegistro(r: Registro): string {
    if (!campo) return "";
    switch (campo.tipo_dato) {
      case 'escala_1_5': return `Nivel ${r.valor_numero}`;
      case 'numero': return String(r.valor_numero);
      case 'hora_unica': return r.hora_inicio ? horaHHMM(r.hora_inicio) : "—";
      case 'rango_horas': return (r.hora_inicio && r.hora_fin) ? formatDuracion(r.hora_inicio, r.hora_fin) : "—";
      case 'si_no': return r.valor_booleano ? "Sí" : "No";
      case 'texto_corto': return r.valor_texto || "—";
      default: return "—";
    }
  }

  if (cargando || !campo) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  const esFamilia = rol === 'familia';

  return (
    <main className="min-h-screen bg-white pb-10">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <button onClick={() => router.back()} className="text-slate-400 text-sm mb-3">← Regresar</button>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">{campo.icono || '📊'}</span>
          <h1 className="text-slate-900 text-xl font-semibold">{campo.nombre}</h1>
        </div>
        <p className="text-slate-400 text-sm mb-6">{nombreParaEquipo}</p>

        {esFamilia && (
          !formAbierto ? (
            <button
              onClick={() => { limpiarFormulario(); setFormAbierto(true); }}
              className="w-full border border-dashed border-blue-200 bg-blue-50/40 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 text-[#1A6BFF] text-sm font-medium mb-6"
            >
              <span className="text-lg">➕</span> Nuevo registro
            </button>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-slate-800 text-sm font-medium">
                  {campo.tipo_dato === 'rango_horas' ? 'Noche/inicio del' : 'Fecha'}
                </span>
                <input type="date" value={fecha} max={hoyISO()} onChange={e => setFecha(e.target.value)}
                  className="border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              {campo.tipo_dato === 'escala_1_5' && (
                <div className="mb-3">
                  <p className="text-slate-500 text-xs mb-2">Nivel</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} onClick={() => setValorNumero(n)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${valorNumero === n ? "bg-[#1A6BFF] text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {campo.tipo_dato === 'numero' && (
                <div className="mb-3">
                  <p className="text-slate-500 text-xs mb-1.5">Valor</p>
                  <input type="number" value={valorNumero} onChange={e => setValorNumero(Number(e.target.value))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              )}

              {campo.tipo_dato === 'hora_unica' && (
                <div className="mb-3">
                  <p className="text-slate-500 text-xs mb-1.5">Hora</p>
                  <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              )}

              {campo.tipo_dato === 'rango_horas' && (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-slate-500 text-xs mb-1.5">Inicio</p>
                    <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-1.5">Fin</p>
                    <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                    {horaFin < horaInicio && <p className="text-slate-400 text-[10px] mt-1">Se asume {sumarDias(fecha, 1)}</p>}
                  </div>
                </div>
              )}

              {campo.tipo_dato === 'si_no' && (
                <div className="mb-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setValorBooleano(true)}
                      className={`py-2.5 rounded-xl text-sm font-medium ${valorBooleano === true ? "bg-[#1A6BFF] text-white" : "bg-white border border-slate-200 text-slate-600"}`}>Sí</button>
                    <button onClick={() => setValorBooleano(false)}
                      className={`py-2.5 rounded-xl text-sm font-medium ${valorBooleano === false ? "bg-[#1A6BFF] text-white" : "bg-white border border-slate-200 text-slate-600"}`}>No</button>
                  </div>
                </div>
              )}

              {campo.tipo_dato === 'texto_corto' && (
                <div className="mb-3">
                  <input type="text" value={valorTexto} onChange={e => setValorTexto(e.target.value)}
                    placeholder="Escribe aquí..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              )}

              {campo.permite_foto && (
                <div className="mb-3">
                  <p className="text-slate-500 text-xs mb-1.5">Foto (opcional)</p>
                  <div onClick={() => fotoInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer bg-white">
                    {previewFoto ? (
                      <img src={previewFoto} alt="preview" className="max-h-28 mx-auto rounded-lg object-contain" />
                    ) : (
                      <p className="text-slate-400 text-sm">📷 Toca para adjuntar foto</p>
                    )}
                  </div>
                  <input ref={fotoInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" onChange={onFotoSeleccionada} className="hidden" />
                </div>
              )}

              <div className="mb-3">
                <p className="text-slate-500 text-xs mb-1.5">Nota (opcional)</p>
                <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm resize-none focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

              <div className="flex gap-3">
                <button onClick={() => { setFormAbierto(false); limpiarFormulario(); }} className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl">Cancelar</button>
                <button onClick={guardarRegistro} disabled={guardando}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )
        )}

        <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Historial</p>
        {registros.length === 0 ? (
          <p className="text-slate-300 text-sm text-center py-8">Sin registros todavía</p>
        ) : (
          <div className="flex flex-col gap-2">
            {registros.map(r => (
              <div key={r.id} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-slate-900 text-sm font-semibold">{formatValorRegistro(r)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatFechaCorta(r.fecha)}</p>
                  {r.nota && <p className="text-slate-500 text-xs mt-1 italic">{r.nota}</p>}
                </div>
                {r.foto_url && <span className="text-lg flex-shrink-0">📷</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}