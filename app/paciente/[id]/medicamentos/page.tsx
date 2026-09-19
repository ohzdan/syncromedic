"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'
type TipoRepeticion = 'diario' | 'cada_x_dias' | 'dias_semana' | 'una_vez';

type Medicamento = {
  id: string;
  nombre_medicamento: string;
  dosis: string;
  horarios: string[] | null;
  tipo_repeticion: TipoRepeticion | null;
  intervalo_dias: number | null;
  dias_semana: number[] | null;
  indicado_por: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  notas: string | null;
  activo: boolean;
};

const DIAS_SEMANA_LABELS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

function formatFecha(fecha: string) {
  return new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

function formatRepeticion(med: Medicamento) {
  switch (med.tipo_repeticion) {
    case 'diario': return 'Diario';
    case 'cada_x_dias': return `Cada ${med.intervalo_dias ?? '?'} días`;
    case 'dias_semana': return (med.dias_semana ?? []).map(d => DIAS_SEMANA_LABELS[d]).join(', ') || 'Días específicos';
    case 'una_vez': return 'Una sola vez';
    default: return 'Diario';
  }
}

export default function MedicamentosPage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [nombreParaEquipo, setNombreParaEquipo] = useState("");
  const [rol, setRol] = useState<Rol>('familia');
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [equipo, setEquipo] = useState<any[]>([]);

  const [formAbierto, setFormAbierto] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  const [nombre, setNombre] = useState("");
  const [dosis, setDosis] = useState("");
  const [horarios, setHorarios] = useState<string[]>(['08:00']);
  const [tipoRepeticion, setTipoRepeticion] = useState<TipoRepeticion>('diario');
  const [intervaloDias, setIntervaloDias] = useState(15);
  const [diasSemana, setDiasSemana] = useState<number[]>([]);
  const [indicadoPor, setIndicadoPor] = useState("");
  const [indicadoPorOtro, setIndicadoPorOtro] = useState("");
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));
  const [tieneFechaFin, setTieneFechaFin] = useState(false);
  const [fechaFin, setFechaFin] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => { cargarDatos(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    setRol((userData?.role || user.user_metadata?.role || 'familia') as Rol);

    const { data: pac } = await supabase.from("pacientes").select("nombre, apodo").eq("id", pacienteId).single();
    if (!pac) { router.push('/dashboard'); return; }
    setNombreParaEquipo(pac.apodo || pac.nombre);

    const { data: accesos } = await supabase
      .from("expediente_accesos")
      .select("usuario_id")
      .eq("paciente_id", pacienteId)
      .eq("estado", "activo");

    if (accesos && accesos.length > 0) {
      const ids = accesos.map((a: any) => a.usuario_id);
      const { data: medicos } = await supabase.from("users").select("id, full_name, especialidad").in("id", ids);
      setEquipo(medicos || []);
    }

    await cargarMedicamentos();
    setLoading(false);
  }

  async function cargarMedicamentos() {
    const { data } = await supabase
      .from("medicamentos_activos")
      .select("id, nombre_medicamento, dosis, horarios, tipo_repeticion, intervalo_dias, dias_semana, indicado_por, fecha_inicio, fecha_fin, notas, activo")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false });
    setMedicamentos((data || []) as Medicamento[]);
  }

  function limpiarFormulario() {
    setNombre(""); setDosis(""); setHorarios(['08:00']); setTipoRepeticion('diario');
    setIntervaloDias(15); setDiasSemana([]); setIndicadoPor(""); setIndicadoPorOtro("");
    setFechaInicio(new Date().toISOString().slice(0, 10)); setTieneFechaFin(false);
    setFechaFin(""); setNotas(""); setError("");
  }

  function agregarToma() { setHorarios(prev => [...prev, '08:00']); }
  function quitarToma(i: number) { setHorarios(prev => prev.filter((_, idx) => idx !== i)); }
  function actualizarToma(i: number, valor: string) { setHorarios(prev => prev.map((h, idx) => idx === i ? valor : h)); }

  function alternarDiaSemana(dia: number) {
    setDiasSemana(prev => prev.includes(dia) ? prev.filter(d => d !== dia) : [...prev, dia].sort());
  }

  async function guardarMedicamento() {
    const indicadoFinal = indicadoPor === "Otro" ? indicadoPorOtro : indicadoPor;
    if (!nombre || !dosis || !indicadoFinal || !fechaInicio || horarios.length === 0) {
      setError("Completa los campos obligatorios.");
      return;
    }
    if (tipoRepeticion === 'dias_semana' && diasSemana.length === 0) {
      setError("Elige al menos un día de la semana.");
      return;
    }

    setGuardando(true);
    setError("");

    const { error: dbError } = await supabase.from("medicamentos_activos").insert({
      paciente_id: pacienteId,
      nombre_medicamento: nombre,
      dosis,
      horarios,
      tipo_repeticion: tipoRepeticion,
      intervalo_dias: tipoRepeticion === 'cada_x_dias' ? intervaloDias : null,
      dias_semana: tipoRepeticion === 'dias_semana' ? diasSemana : null,
      indicado_por: indicadoFinal,
      fecha_inicio: fechaInicio,
      fecha_fin: tieneFechaFin && fechaFin ? fechaFin : null,
      notas: notas || null,
      activo: true,
    });

    if (dbError) {
      setError("Error al guardar. Intenta de nuevo.");
      setGuardando(false);
      return;
    }

    setFormAbierto(false);
    limpiarFormulario();
    await cargarMedicamentos();
    setGuardando(false);
  }

  async function desactivarMedicamento(id: string, nombreMed: string) {
    if (!confirm(`¿Marcar "${nombreMed}" como suspendido?`)) return;
    await supabase.from("medicamentos_activos").update({ activo: false, fecha_suspension: new Date().toISOString().slice(0, 10) }).eq("id", id);
    await cargarMedicamentos();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  const esFamilia = rol === 'familia';
  const activos = medicamentos.filter(m => m.activo);
  const historial = medicamentos.filter(m => !m.activo);

  return (
    <main className="min-h-screen bg-white pb-10">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <button onClick={() => router.back()} className="text-slate-400 text-sm mb-3">← Regresar</button>
        <h1 className="text-slate-900 text-xl font-semibold mb-1">Medicamentos</h1>
        <p className="text-slate-400 text-sm mb-6">{nombreParaEquipo}</p>

        {activos.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center mb-6">
            <p className="text-3xl mb-2">💊</p>
            <p className="text-slate-400 text-sm">No hay medicamentos activos registrados</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 mb-6">
            {activos.map(med => (
              <div key={med.id} className="bg-slate-50 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 text-sm font-semibold">{med.nombre_medicamento} <span className="text-slate-400 font-normal">· {med.dosis}</span></p>
                    <p className="text-slate-500 text-xs mt-1">
                      {(med.horarios || []).join(', ')} · {formatRepeticion(med)}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">Indicado por: {med.indicado_por}</p>
                    <p className="text-slate-400 text-xs">
                      Desde {formatFecha(med.fecha_inicio)}{med.fecha_fin ? ` · Hasta ${formatFecha(med.fecha_fin)}` : ' · Sin fecha de fin'}
                    </p>
                    {med.notas && <p className="text-slate-500 text-xs mt-1.5 italic">{med.notas}</p>}
                  </div>
                  {esFamilia && (
                    <button
                      onClick={() => desactivarMedicamento(med.id, med.nombre_medicamento)}
                      className="text-slate-400 hover:text-red-500 text-xs px-2.5 py-1 border border-slate-200 rounded-lg flex-shrink-0"
                    >
                      Suspender
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {historial.length > 0 && (
          <div className="mb-6">
            <button onClick={() => setVerHistorial(!verHistorial)} className="text-slate-400 text-xs mb-2">
              {verHistorial ? "▾" : "▸"} Historial de suspendidos ({historial.length})
            </button>
            {verHistorial && (
              <div className="flex flex-col gap-2">
                {historial.map(med => (
                  <div key={med.id} className="bg-slate-50 rounded-2xl p-4 opacity-60">
                    <p className="text-slate-700 text-sm font-medium">{med.nombre_medicamento} · {med.dosis}</p>
                    <p className="text-slate-400 text-xs mt-0.5">Indicado por: {med.indicado_por}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {esFamilia && (
          !formAbierto ? (
            <button
              onClick={() => { limpiarFormulario(); setFormAbierto(true); }}
              className="w-full border border-dashed border-blue-200 bg-blue-50/40 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 text-[#1A6BFF] text-sm font-medium"
            >
              <span className="text-lg">➕</span> Agregar medicamento
            </button>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-slate-400 text-[11px] uppercase tracking-wide mb-3">Nuevo medicamento</p>

              <label className="text-slate-500 text-xs block mb-1.5">Nombre y dosis *</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Melatonina"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                <input type="text" value={dosis} onChange={e => setDosis(e.target.value)} placeholder="Ej. 3mg"
                  className="border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              <label className="text-slate-500 text-xs block mb-1.5">Tomas al día *</label>
              <div className="flex flex-col gap-2 mb-4">
                {horarios.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs w-14 flex-shrink-0">Toma {i + 1}</span>
                    <input type="time" value={h} onChange={e => actualizarToma(i, e.target.value)}
                      className="flex-1 border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                    {horarios.length > 1 && (
                      <button onClick={() => quitarToma(i)} className="text-red-400 text-xs flex-shrink-0">Quitar</button>
                    )}
                  </div>
                ))}
                <button onClick={agregarToma} className="text-[#1A6BFF] text-xs font-medium text-left">+ Agregar otra toma</button>
              </div>

              <label className="text-slate-500 text-xs block mb-1.5">Se repite *</label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {([
                  { value: 'diario', label: 'Diario' },
                  { value: 'cada_x_dias', label: 'Cada X días' },
                  { value: 'dias_semana', label: 'Días de la semana' },
                  { value: 'una_vez', label: 'Una sola vez' },
                ] as { value: TipoRepeticion; label: string }[]).map(t => (
                  <button key={t.value} onClick={() => setTipoRepeticion(t.value)}
                    className={`py-2 rounded-xl text-xs font-medium ${tipoRepeticion === t.value ? "bg-blue-50 text-[#1A6BFF] border border-[#1A6BFF]" : "bg-white text-slate-600 border border-slate-200"}`}>
                    {t.label}
                  </button>
                ))}
              </div>

              {tipoRepeticion === 'cada_x_dias' && (
                <div className="mb-4">
                  <label className="text-slate-500 text-xs block mb-1.5">Cada cuántos días</label>
                  <input type="number" min={1} value={intervaloDias} onChange={e => setIntervaloDias(Number(e.target.value))}
                    className="w-24 border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              )}

              {tipoRepeticion === 'dias_semana' && (
                <div className="mb-4">
                  <label className="text-slate-500 text-xs block mb-1.5">Qué días</label>
                  <div className="flex gap-1.5">
                    {DIAS_SEMANA_LABELS.map((label, i) => (
                      <button key={i} onClick={() => alternarDiaSemana(i)}
                        className={`w-9 h-9 rounded-full text-xs font-medium ${diasSemana.includes(i) ? "bg-[#1A6BFF] text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="text-slate-500 text-xs block mb-1.5">Indicado por *</label>
              {equipo.length > 0 ? (
                <select value={indicadoPor} onChange={e => setIndicadoPor(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm mb-2 focus:outline-none focus:border-[#1A6BFF]">
                  <option value="">Seleccionar médico</option>
                  {equipo.map(m => (
                    <option key={m.id} value={m.full_name || m.id}>{m.full_name}{m.especialidad ? ` — ${m.especialidad}` : ""}</option>
                  ))}
                  <option value="Otro">Otro médico (externo)</option>
                </select>
              ) : (
                <input type="text" value={indicadoPor} onChange={e => setIndicadoPor(e.target.value)}
                  placeholder="Ej. Dra. Martínez — Neurología"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm mb-2 focus:outline-none focus:border-[#1A6BFF]" />
              )}
              {indicadoPor === "Otro" && (
                <input type="text" value={indicadoPorOtro} onChange={e => setIndicadoPorOtro(e.target.value)}
                  placeholder="Nombre del médico externo"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm mb-4 focus:outline-none focus:border-[#1A6BFF]" />
              )}

              <div className="mb-1 mt-2">
                <label className="text-slate-500 text-xs block mb-1.5">Duración del tratamiento</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-slate-400 text-[11px] mb-1">Empieza</p>
                    <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                  </div>
                  <div>
                    <p className="text-slate-400 text-[11px] mb-1">Termina (opcional)</p>
                    <input type="date" value={fechaFin} disabled={!tieneFechaFin}
                      onChange={e => setFechaFin(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-800 text-sm disabled:bg-slate-100 focus:outline-none focus:border-[#1A6BFF]" />
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input type="checkbox" checked={tieneFechaFin} onChange={e => setTieneFechaFin(e.target.checked)} className="rounded" />
                  <span className="text-slate-400 text-[11px]">Tiene fecha de fin definida</span>
                </label>
              </div>

              <div className="mt-4 mb-1">
                <label className="text-slate-500 text-xs block mb-1.5">Indicaciones especiales (opcional)</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Ej. Después de bañarse, con comida, evitar sol..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm resize-none focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <div className="flex gap-3 mt-4">
                <button onClick={() => { setFormAbierto(false); limpiarFormulario(); }}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl">
                  Cancelar
                </button>
                <button onClick={guardarMedicamento} disabled={guardando}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}