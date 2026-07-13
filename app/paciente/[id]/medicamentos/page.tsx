"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const FRECUENCIAS = [
  "Una vez al día",
  "Dos veces al día",
  "Tres veces al día",
  "Cada 8 horas",
  "Cada 12 horas",
  "Cada 24 horas",
  "Solo en la mañana",
  "Solo en la noche",
  "Según necesidad",
  "Otra",
];

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'

type Medicamento = {
  id: string;
  nombre_medicamento: string;
  dosis: string;
  frecuencia: string;
  indicado_por: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  fecha_suspension: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
};

export default function MedicamentosPage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [paciente, setPaciente] = useState<any>(null);
  const [rol, setRol] = useState<Rol>('familia');
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [equipo, setEquipo] = useState<any[]>([]);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  const [nombre, setNombre] = useState("");
  const [dosis, setDosis] = useState("");
  const [frecuencia, setFrecuencia] = useState("");
  const [frecuenciaOtra, setFrecuenciaOtra] = useState("");
  const [indicadoPor, setIndicadoPor] = useState("");
  const [indicadoPorOtro, setIndicadoPorOtro] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [tieneFechaFin, setTieneFechaFin] = useState(false);
  const [fechaFin, setFechaFin] = useState("");
  const [notas, setNotas] = useState("");

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    setRol((userData?.role || user.user_metadata?.role || 'familia') as Rol);

    const { data: pac } = await supabase.from("pacientes").select("id, nombre").eq("id", pacienteId).single();
    setPaciente(pac);

    const { data: accesos } = await supabase
      .from("expediente_accesos")
      .select("usuario_id")
      .eq("paciente_id", pacienteId)
      .eq("estado", "activo");

    if (accesos && accesos.length > 0) {
      const ids = accesos.map((a: any) => a.usuario_id);
      const { data: medicos } = await supabase
        .from("users")
        .select("id, full_name, especialidad")
        .in("id", ids);
      setEquipo(medicos || []);
    }

    await cargarMedicamentos();
    setLoading(false);
  }

  async function cargarMedicamentos() {
    const { data } = await supabase
      .from("medicamentos_activos")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("created_at", { ascending: false });
    setMedicamentos(data || []);
  }

  function limpiarFormulario() {
    setNombre(""); setDosis(""); setFrecuencia(""); setFrecuenciaOtra("");
    setIndicadoPor(""); setIndicadoPorOtro(""); setFechaInicio("");
    setTieneFechaFin(false); setFechaFin(""); setNotas(""); setError("");
  }

  async function guardarMedicamento() {
    const indicadoFinal = indicadoPor === "Otro" ? indicadoPorOtro : indicadoPor;
    if (!nombre || !dosis || !frecuencia || !indicadoFinal || !fechaInicio) {
      setError("Completa los campos obligatorios.");
      return;
    }
    setGuardando(true);
    setError("");

    const frecuenciaFinal = frecuencia === "Otra" ? frecuenciaOtra : frecuencia;

    const { error: dbError } = await supabase.from("medicamentos_activos").insert({
      paciente_id: pacienteId,
      nombre_medicamento: nombre,
      dosis,
      frecuencia: frecuenciaFinal,
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

    setModalAbierto(false);
    limpiarFormulario();
    await cargarMedicamentos();
    setGuardando(false);
  }

  async function desactivarMedicamento(id: string, nombre: string) {
    if (!confirm(`¿Marcar "${nombre}" como suspendido?`)) return;
    const fechaSuspension = new Date().toISOString().slice(0, 10);
    await supabase.from("medicamentos_activos").update({ activo: false, fecha_suspension: fechaSuspension }).eq("id", id);
    await cargarMedicamentos();
  }

  const esFamilia = rol === 'familia';
  const activos = medicamentos.filter(m => m.activo);
  const historial = medicamentos.filter(m => !m.activo);

  function formatFecha(fecha: string) {
    return new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando...</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">Syncro<span className="text-[#00C97A]">Medic</span></span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm">← Regresar</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-slate-800 text-2xl font-bold">Medicamentos</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {paciente?.nombre}
              {!esFamilia && <span className="text-slate-400"> · solo lectura</span>}
            </p>
          </div>
          {esFamilia && (
            <button
              onClick={() => { limpiarFormulario(); setModalAbierto(true); }}
              className="bg-[#1A6BFF] hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              + Agregar
            </button>
          )}
        </div>

        <h2 className="text-slate-600 text-xs font-semibold uppercase tracking-wide mb-3">Activos</h2>
        {activos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm mb-6">
            <div className="text-4xl mb-3">💊</div>
            <p className="text-slate-500 text-sm">No hay medicamentos activos registrados.</p>
            {esFamilia && (
              <button onClick={() => { limpiarFormulario(); setModalAbierto(true); }} className="mt-4 text-[#1A6BFF] text-sm hover:underline">
                Agregar el primero →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-6">
            {activos.map(med => (
              <div key={med.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-slate-800 font-semibold">{med.nombre_medicamento}</h3>
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">Activo</span>
                    </div>
                    <p className="text-slate-600 text-sm">{med.dosis} · {med.frecuencia}</p>
                    <p className="text-slate-400 text-xs mt-1">Indicado por: {med.indicado_por}</p>
                    <p className="text-slate-400 text-xs">Desde: {formatFecha(med.fecha_inicio)}{med.fecha_fin ? ` · Hasta: ${formatFecha(med.fecha_fin)}` : ""}</p>
                    {med.notas && <p className="text-slate-500 text-xs mt-2 italic">"{med.notas}"</p>}
                  </div>
                  {esFamilia && (
                    <button
                      onClick={() => desactivarMedicamento(med.id, med.nombre_medicamento)}
                      className="text-slate-400 hover:text-red-500 text-xs px-3 py-1.5 border border-slate-200 hover:border-red-200 rounded-lg transition-colors flex-shrink-0"
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
          <div>
            <button
              onClick={() => setVerHistorial(!verHistorial)}
              className="text-slate-400 hover:text-slate-600 text-sm mb-3 flex items-center gap-1"
            >
              {verHistorial ? "▾" : "▸"} Historial de medicamentos suspendidos ({historial.length})
            </button>
            {verHistorial && (
              <div className="flex flex-col gap-3">
                {historial.map(med => (
                  <div key={med.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm opacity-60">
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-slate-600 font-semibold">{med.nombre_medicamento}</h3>
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Suspendido</span>
                        </div>
                        <p className="text-slate-500 text-sm">{med.dosis} · {med.frecuencia}</p>
                        <p className="text-slate-400 text-xs mt-1">Indicado por: {med.indicado_por}</p>
                        <p className="text-slate-400 text-xs">Desde: {formatFecha(med.fecha_inicio)}{med.fecha_fin ? ` · Hasta: ${formatFecha(med.fecha_fin)}` : ""}</p>
                        {med.notas && <p className="text-slate-400 text-xs mt-2 italic">"{med.notas}"</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {modalAbierto && esFamilia && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-slate-800 text-lg font-bold mb-5">Agregar medicamento</h2>
            <div className="flex flex-col gap-4">

              <div>
                <label className="text-slate-500 text-xs mb-1 block">Nombre del medicamento *</label>
                <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Risperidona"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block">Dosis *</label>
                <input type="text" value={dosis} onChange={e => setDosis(e.target.value)}
                  placeholder="Ej: 0.5 mg"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-2 block">Frecuencia *</label>
                <div className="flex flex-col gap-2">
                  {FRECUENCIAS.map(f => (
                    <button key={f} onClick={() => setFrecuencia(f)}
                      className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${frecuencia === f ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                      {f}
                    </button>
                  ))}
                </div>
                {frecuencia === "Otra" && (
                  <input type="text" value={frecuenciaOtra} onChange={e => setFrecuenciaOtra(e.target.value)}
                    placeholder="Especifica la frecuencia"
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                )}
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block">Indicado por *</label>
                {equipo.length > 0 ? (
                  <select value={indicadoPor} onChange={e => setIndicadoPor(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]">
                    <option value="">Seleccionar médico</option>
                    {equipo.map(m => (
                      <option key={m.id} value={m.full_name || m.id}>
                        {m.full_name}{m.especialidad ? ` — ${m.especialidad}` : ""}
                      </option>
                    ))}
                    <option value="Otro">Otro médico (externo)</option>
                  </select>
                ) : (
                  <input type="text" value={indicadoPor} onChange={e => setIndicadoPor(e.target.value)}
                    placeholder="Ej: Dr. Ramírez — Neurología"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                )}
                {indicadoPor === "Otro" && (
                  <input type="text" value={indicadoPorOtro} onChange={e => setIndicadoPorOtro(e.target.value)}
                    placeholder="Nombre del médico externo"
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                )}
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block">Fecha de inicio *</label>
                <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={tieneFechaFin} onChange={e => setTieneFechaFin(e.target.checked)} className="rounded" />
                  <span className="text-slate-500 text-xs">Tratamiento temporal (tiene fecha de fin)</span>
                </label>
                {tieneFechaFin && (
                  <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)}
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                )}
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block">Notas adicionales</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Ej: Tomar con alimentos. Evitar exposición al sol."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3 mt-2">
                <button onClick={() => { setModalAbierto(false); limpiarFormulario(); }}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={guardarMedicamento} disabled={guardando}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}