"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const TIPOS_NOTA = [
  { id: "consulta", label: "Consulta", emoji: "🩺" },
  { id: "sesion_terapia", label: "Sesión de terapia", emoji: "🧠" },
  { id: "urgencia", label: "Urgencia", emoji: "🚨" },
  { id: "seguimiento", label: "Seguimiento", emoji: "📊" },
  { id: "interconsulta", label: "Interconsulta", emoji: "🔄" },
];

type Nota = {
  id: string;
  tipo_nota: string;
  motivo: string | null;
  subjetivo: string | null;
  objetivo: string | null;
  diagnostico_cie10: string[] | null;
  plan: string | null;
  indicaciones: string | null;
  proxima_cita: string | null;
  imagen_path: string | null;
  fecha_consulta: string;
  created_at: string;
  autor_id: string;
  autor_nombre: string;
  especialidad: string | null;
  firmada: boolean;
  firma_fecha: string | null;
  firma_nombre: string | null;
};

export default function NotasPage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [paciente, setPaciente] = useState<any>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [firmando, setFirmando] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [usuario, setUsuario] = useState<any>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [modalFirma, setModalFirma] = useState<Nota | null>(null);

  // Formulario SOAP
  const [tipo, setTipo] = useState("");
  const [fechaConsulta, setFechaConsulta] = useState(new Date().toISOString().split("T")[0]);
  const [motivo, setMotivo] = useState("");
  const [subjetivo, setSubjetivo] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [plan, setPlan] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  const [proximaCita, setProximaCita] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Visor
  const [notaVisor, setNotaVisor] = useState<Nota | null>(null);
  const [urlVisor, setUrlVisor] = useState<string | null>(null);
  const [notaExpandida, setNotaExpandida] = useState<string | null>(null);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: userData } = await supabase
      .from("users")
      .select("role, full_name, especialidad")
      .eq("id", user.id)
      .single();
    setUsuario({ ...userData, id: user.id });

    const { data: pac } = await supabase
      .from("pacientes")
      .select("id, nombre")
      .eq("id", pacienteId)
      .single();
    setPaciente(pac);

    await cargarNotas();
    setLoading(false);
  }

  async function cargarNotas() {
    const { data } = await supabase
      .from("notas_clinicas")
      .select("*")
      .eq("paciente_id", pacienteId)
      .is("deleted_at", null)
      .order("fecha_consulta", { ascending: false });
    setNotas(data || []);
  }

  function limpiarFormulario() {
    setTipo(""); setMotivo(""); setSubjetivo(""); setObjetivo("");
    setPlan(""); setIndicaciones(""); setProximaCita("");
    setImagen(null); setPreview(null); setError("");
    setFechaConsulta(new Date().toISOString().split("T")[0]);
  }

  function onImagenSeleccionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagen(file);
    setPreview(URL.createObjectURL(file));
  }

  async function guardarNota() {
    if (!tipo || !fechaConsulta) {
      setError("Selecciona el tipo de nota y la fecha.");
      return;
    }
    if (!motivo && !subjetivo && !plan) {
      setError("Completa al menos el motivo, subjetivo o plan.");
      return;
    }
    setGuardando(true);
    setError("");

    let imagenPath = null;
    if (imagen) {
      const ext = imagen.name.split(".").pop();
      const path = `notas/${pacienteId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("documentos")
        .upload(path, imagen);
      if (uploadError) {
        setError("Error al subir la imagen.");
        setGuardando(false);
        return;
      }
      imagenPath = path;
    }

    const { error: dbError } = await supabase.from("notas_clinicas").insert({
      paciente_id:    pacienteId,
      tipo_nota:      tipo,
      fecha_consulta: fechaConsulta,
      motivo:         motivo || null,
      subjetivo:      subjetivo || null,
      objetivo:       objetivo || null,
      plan:           plan || null,
      indicaciones:   indicaciones || null,
      proxima_cita:   proximaCita || null,
      imagen_path:    imagenPath,
      autor_id:       usuario.id,
      autor_nombre:   usuario.full_name || "Usuario",
      especialidad:   usuario.especialidad || null,
      firmada:        false,
      firma_fecha:    null,
      firma_nombre:   null,
    });

    if (dbError) {
      setError(dbError.message);
      setGuardando(false);
      return;
    }

    setModalAbierto(false);
    limpiarFormulario();
    await cargarNotas();
    setGuardando(false);
  }

  async function firmarNota(nota: Nota) {
    setFirmando(nota.id);
    const ahora = new Date().toISOString();
    const { error } = await supabase
      .from("notas_clinicas")
      .update({
        firmada: true,
        firma_fecha: ahora,
        firma_nombre: usuario.full_name,
      })
      .eq("id", nota.id);

    if (!error) {
      await cargarNotas();
      setModalFirma(null);
    }
    setFirmando(null);
  }

  async function abrirImagen(nota: Nota) {
    if (!nota.imagen_path) return;
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(nota.imagen_path, 60);
    if (data?.signedUrl) {
      setNotaVisor(nota);
      setUrlVisor(data.signedUrl);
    }
  }

  function formatFecha(fecha: string) {
    return new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", {
      day: "numeric", month: "long", year: "numeric"
    });
  }

  function formatFechaHora(fecha: string) {
    return new Date(fecha).toLocaleDateString("es-MX", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  }

  const notasFiltradas = filtroTipo === "todos"
    ? notas
    : notas.filter(n => n.tipo_nota === filtroTipo);

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
          <span className="text-slate-800 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm">
          ← Regresar
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-slate-800 text-2xl font-bold">Notas clínicas</h1>
            <p className="text-slate-500 text-sm mt-0.5">{paciente?.nombre}</p>
          </div>
          <button
            onClick={() => { limpiarFormulario(); setModalAbierto(true); }}
            className="bg-[#1A6BFF] hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            + Nueva nota
          </button>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFiltroTipo("todos")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroTipo === "todos" ? "bg-[#1A6BFF] border-[#1A6BFF] text-white" : "border-slate-200 text-slate-600 bg-white"}`}
          >
            📋 Todas
          </button>
          {TIPOS_NOTA.map(t => (
            <button
              key={t.id}
              onClick={() => setFiltroTipo(t.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtroTipo === t.id ? "bg-[#1A6BFF] border-[#1A6BFF] text-white" : "border-slate-200 text-slate-600 bg-white"}`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        {/* Lista de notas */}
        {notasFiltradas.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-500 text-sm">
              {filtroTipo === "todos" ? "Aún no hay notas clínicas." : "No hay notas de este tipo."}
            </p>
            <button
              onClick={() => { limpiarFormulario(); setModalAbierto(true); }}
              className="mt-4 text-[#1A6BFF] text-sm hover:underline"
            >
              Agregar la primera →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {notasFiltradas.map(nota => {
              const tipoInfo = TIPOS_NOTA.find(t => t.id === nota.tipo_nota);
              const expandida = notaExpandida === nota.id;
              const esAutor = usuario?.id === nota.autor_id;
              return (
                <div key={nota.id} className={`bg-white border rounded-2xl shadow-sm overflow-hidden ${nota.firmada ? "border-green-200" : "border-slate-200"}`}>
                  {/* Header de la nota */}
                  <div
                    className="flex items-start justify-between gap-4 p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setNotaExpandida(expandida ? null : nota.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tipoInfo?.emoji || "📝"}</span>
                      <div>
                        <p className="text-slate-800 text-sm font-semibold">{tipoInfo?.label || nota.tipo_nota}</p>
                        <p className="text-slate-400 text-xs">{formatFecha(nota.fecha_consulta)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-slate-600 text-xs font-medium">{nota.autor_nombre}</p>
                        {nota.especialidad && <p className="text-slate-400 text-xs">{nota.especialidad}</p>}
                        {nota.firmada && (
                          <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium mt-0.5">
                            ✅ Firmada
                          </span>
                        )}
                      </div>
                      <span className="text-slate-300 text-sm">{expandida ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Contenido SOAP expandido */}
                  {expandida && (
                    <div className="px-5 pb-5 border-t border-slate-100">
                      <div className="mt-4 flex flex-col gap-3">
                        {nota.motivo && (
                          <div>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Motivo</p>
                            <p className="text-slate-700 text-sm">{nota.motivo}</p>
                          </div>
                        )}
                        {nota.subjetivo && (
                          <div>
                            <p className="text-xs font-semibold text-[#1A6BFF] uppercase tracking-wide mb-1">S — Subjetivo</p>
                            <p className="text-slate-700 text-sm whitespace-pre-wrap">{nota.subjetivo}</p>
                          </div>
                        )}
                        {nota.objetivo && (
                          <div>
                            <p className="text-xs font-semibold text-[#00C97A] uppercase tracking-wide mb-1">O — Objetivo</p>
                            <p className="text-slate-700 text-sm whitespace-pre-wrap">{nota.objetivo}</p>
                          </div>
                        )}
                        {nota.plan && (
                          <div>
                            <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide mb-1">P — Plan</p>
                            <p className="text-slate-700 text-sm whitespace-pre-wrap">{nota.plan}</p>
                          </div>
                        )}
                        {nota.indicaciones && (
                          <div>
                            <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-1">Indicaciones</p>
                            <p className="text-slate-700 text-sm whitespace-pre-wrap">{nota.indicaciones}</p>
                          </div>
                        )}
                        {nota.proxima_cita && (
                          <div className="bg-blue-50 rounded-xl px-4 py-2 inline-block">
                            <p className="text-xs text-[#1A6BFF] font-medium">📅 Próxima cita: {formatFecha(nota.proxima_cita)}</p>
                          </div>
                        )}
                        {nota.imagen_path && (
                          <button
                            onClick={() => abrirImagen(nota)}
                            className="flex items-center gap-2 text-[#1A6BFF] text-xs font-medium hover:underline"
                          >
                            🖼️ Ver imagen adjunta →
                          </button>
                        )}

                        {/* Firma */}
                        {nota.firmada && nota.firma_fecha ? (
                          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mt-2">
                            <p className="text-green-700 text-xs font-semibold">✅ Nota firmada electrónicamente</p>
                            <p className="text-green-600 text-xs mt-0.5">
                              {nota.firma_nombre} · {formatFechaHora(nota.firma_fecha)}
                            </p>
                            <p className="text-green-500 text-xs mt-1 opacity-70">
                              Esta nota no puede ser modificada · NOM-004-SSA3-2012
                            </p>
                          </div>
                        ) : esAutor ? (
                          <button
                            onClick={() => setModalFirma(nota)}
                            className="mt-2 w-full border border-[#1A6BFF] text-[#1A6BFF] text-sm font-semibold py-2.5 rounded-xl hover:bg-blue-50 transition-colors"
                          >
                            ✍️ Firmar nota
                          </button>
                        ) : (
                          <p className="text-slate-400 text-xs mt-2 italic">Pendiente de firma por el autor</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nueva nota SOAP */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-slate-800 text-lg font-bold mb-5">Nueva nota clínica</h2>
            <div className="flex flex-col gap-4">

              <div>
                <label className="text-slate-500 text-xs mb-2 block font-medium">Tipo de nota *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_NOTA.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setTipo(t.id)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left ${tipo === t.id ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                    >
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block font-medium">Fecha de la consulta *</label>
                <input type="date" value={fechaConsulta} onChange={e => setFechaConsulta(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block font-medium">Motivo de consulta</label>
                <input type="text" value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="¿Por qué viene el paciente hoy?"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              <div>
                <label className="text-xs mb-1 block font-semibold text-[#1A6BFF]">S — Subjetivo</label>
                <p className="text-xs text-slate-400 mb-1">Lo que reporta el paciente o la familia</p>
                <textarea value={subjetivo} onChange={e => setSubjetivo(e.target.value)}
                  placeholder="La mamá refiere que..." rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
              </div>

              <div>
                <label className="text-xs mb-1 block font-semibold text-[#00C97A]">O — Objetivo</label>
                <p className="text-xs text-slate-400 mb-1">Lo que el especialista observa o mide</p>
                <textarea value={objetivo} onChange={e => setObjetivo(e.target.value)}
                  placeholder="Paciente alerta, peso 18kg..." rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
              </div>

              <div>
                <label className="text-xs mb-1 block font-semibold text-purple-500">P — Plan</label>
                <p className="text-xs text-slate-400 mb-1">Diagnóstico y decisiones clínicas</p>
                <textarea value={plan} onChange={e => setPlan(e.target.value)}
                  placeholder="Continuar tratamiento, ajuste de dosis..." rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
              </div>

              <div>
                <label className="text-xs mb-1 block font-semibold text-amber-500">Indicaciones para la familia</label>
                <textarea value={indicaciones} onChange={e => setIndicaciones(e.target.value)}
                  placeholder="Administrar medicamento con alimentos..." rows={2}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block font-medium">Próxima cita (opcional)</label>
                <input type="date" value={proximaCita} onChange={e => setProximaCita(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block font-medium">Imagen adjunta (opcional)</label>
                <div onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#1A6BFF] transition-colors">
                  {preview ? (
                    <img src={preview} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
                  ) : (
                    <p className="text-slate-400 text-sm">📷 Toca para adjuntar imagen</p>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp"
                  onChange={onImagenSeleccionada} className="hidden" />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3 mt-2">
                <button onClick={() => { setModalAbierto(false); limpiarFormulario(); }}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={guardarNota} disabled={guardando}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                  {guardando ? "Guardando..." : "Guardar nota"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar firma */}
      {modalFirma && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">✍️</div>
              <h2 className="text-slate-800 text-lg font-bold mb-2">Firmar nota clínica</h2>
              <p className="text-slate-500 text-sm">Al firmar, esta nota quedará bloqueada y no podrá modificarse.</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 mb-5">
              <p className="text-slate-600 text-xs font-medium mb-1">Firmante</p>
              <p className="text-slate-800 text-sm font-semibold">{usuario?.full_name}</p>
              {usuario?.especialidad && <p className="text-slate-500 text-xs">{usuario.especialidad}</p>}
              <p className="text-slate-400 text-xs mt-1">{new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <p className="text-slate-400 text-xs text-center mb-5">
              En cumplimiento con NOM-004-SSA3-2012
            </p>
            <div className="flex gap-3">
              <button onClick={() => setModalFirma(null)}
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => firmarNota(modalFirma)} disabled={firmando === modalFirma.id}
                className="flex-1 bg-[#00C97A] hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                {firmando === modalFirma.id ? "Firmando..." : "Confirmar firma"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor imagen */}
      {notaVisor && urlVisor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-slate-800 text-sm font-semibold">
                  {TIPOS_NOTA.find(t => t.id === notaVisor.tipo_nota)?.label} — {formatFecha(notaVisor.fecha_consulta)}
                </p>
                <p className="text-slate-400 text-xs">{notaVisor.autor_nombre}</p>
              </div>
              <div className="flex gap-3 items-center">
                <a href={urlVisor} target="_blank" rel="noopener noreferrer"
                  className="text-[#1A6BFF] text-xs font-medium hover:underline">
                  Abrir en nueva pestaña →
                </a>
                <button onClick={() => { setNotaVisor(null); setUrlVisor(null); }}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <img src={urlVisor} alt="nota" className="max-w-full mx-auto rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}