"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const TIPOS_NOTA = [
  { id: "consulta", label: "Consulta", emoji: "🩺" },
  { id: "terapia", label: "Sesión de terapia", emoji: "🧠" },
  { id: "urgencia", label: "Urgencia", emoji: "🚨" },
  { id: "seguimiento", label: "Seguimiento", emoji: "📊" },
  { id: "otro", label: "Otro", emoji: "📝" },
];

type Nota = {
  id: string;
  tipo: string;
  contenido: string;
  imagen_url: string | null;
  imagen_path: string | null;
  fecha_consulta: string;
  created_at: string;
  autor_id: string;
  autor_nombre: string;
  especialidad: string | null;
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
  const [error, setError] = useState("");
  const [usuario, setUsuario] = useState<any>(null);

  const [modalAbierto, setModalAbierto] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("todos");

  // Campos formulario
  const [tipo, setTipo] = useState("");
  const [contenido, setContenido] = useState("");
  const [fechaConsulta, setFechaConsulta] = useState(new Date().toISOString().split("T")[0]);
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [modoImagen, setModoImagen] = useState(false);

  // Visor
  const [notaVisor, setNotaVisor] = useState<Nota | null>(null);
  const [urlVisor, setUrlVisor] = useState<string | null>(null);

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
      .order("fecha_consulta", { ascending: false });
    setNotas(data || []);
  }

  function onImagenSeleccionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagen(file);
    setPreview(URL.createObjectURL(file));
  }

  function limpiarFormulario() {
    setTipo(""); setContenido(""); setImagen(null); setPreview(null);
    setModoImagen(false); setError("");
    setFechaConsulta(new Date().toISOString().split("T")[0]);
  }

  async function guardarNota() {
    if (!tipo || !fechaConsulta) {
      setError("Selecciona el tipo de nota y la fecha.");
      return;
    }
    if (!contenido && !imagen) {
      setError("Agrega texto o una imagen.");
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
      paciente_id: pacienteId,
      tipo,
      contenido: contenido || null,
      imagen_path: imagenPath,
      imagen_url: imagenPath,
      fecha_consulta: fechaConsulta,
      autor_id: usuario.id,
      autor_nombre: usuario.full_name || "Usuario",
      especialidad: usuario.especialidad || null,
    });

    if (dbError) {
      setError("Error al guardar la nota.");
      setGuardando(false);
      return;
    }

    setModalAbierto(false);
    limpiarFormulario();
    await cargarNotas();
    setGuardando(false);
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

  const notasFiltradas = filtroTipo === "todos"
    ? notas
    : notas.filter(n => n.tipo === filtroTipo);

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
              const tipoInfo = TIPOS_NOTA.find(t => t.id === nota.tipo);
              return (
                <div key={nota.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tipoInfo?.emoji || "📝"}</span>
                      <div>
                        <p className="text-slate-800 text-sm font-semibold">{tipoInfo?.label || nota.tipo}</p>
                        <p className="text-slate-400 text-xs">{formatFecha(nota.fecha_consulta)}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-600 text-xs font-medium">{nota.autor_nombre}</p>
                      {nota.especialidad && <p className="text-slate-400 text-xs">{nota.especialidad}</p>}
                    </div>
                  </div>

                  {nota.contenido && (
                    <div className="bg-slate-50 rounded-xl p-4 text-slate-700 text-sm whitespace-pre-wrap border border-slate-100">
                      {nota.contenido}
                    </div>
                  )}

                  {nota.imagen_path && (
                    <button
                      onClick={() => abrirImagen(nota)}
                      className="mt-3 flex items-center gap-2 text-[#1A6BFF] text-xs font-medium hover:underline"
                    >
                      🖼️ Ver imagen adjunta →
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nueva nota */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-slate-800 text-lg font-bold mb-5">Nueva nota clínica</h2>
            <div className="flex flex-col gap-4">

              <div>
                <label className="text-slate-500 text-xs mb-2 block">Tipo de nota *</label>
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
                <label className="text-slate-500 text-xs mb-1 block">Fecha de la consulta *</label>
                <input
                  type="date"
                  value={fechaConsulta}
                  onChange={e => setFechaConsulta(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]"
                />
              </div>

              {/* Toggle texto / imagen */}
              <div className="flex gap-2">
                <button
                  onClick={() => setModoImagen(false)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${!modoImagen ? "bg-[#1A6BFF] border-[#1A6BFF] text-white" : "border-slate-200 text-slate-600"}`}
                >
                  ✏️ Texto
                </button>
                <button
                  onClick={() => setModoImagen(true)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${modoImagen ? "bg-[#1A6BFF] border-[#1A6BFF] text-white" : "border-slate-200 text-slate-600"}`}
                >
                  🖼️ Imagen
                </button>
              </div>

              {!modoImagen ? (
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Contenido de la nota</label>
                  <textarea
                    value={contenido}
                    onChange={e => setContenido(e.target.value)}
                    placeholder="Escribe o pega aquí las notas de la consulta..."
                    rows={6}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Imagen de la nota</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#1A6BFF] transition-colors"
                  >
                    {preview ? (
                      <img src={preview} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                    ) : (
                      <div>
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-slate-500 text-sm">Toca para seleccionar</p>
                        <p className="text-slate-400 text-xs mt-1">JPG o PNG · máx 10 MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={onImagenSeleccionada}
                    className="hidden"
                  />
                </div>
              )}

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => { setModalAbierto(false); limpiarFormulario(); }}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={guardarNota}
                  disabled={guardando}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                >
                  {guardando ? "Guardando..." : "Guardar nota"}
                </button>
              </div>
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
                  {TIPOS_NOTA.find(t => t.id === notaVisor.tipo)?.label} — {formatFecha(notaVisor.fecha_consulta)}
                </p>
                <p className="text-slate-400 text-xs">{notaVisor.autor_nombre}</p>
              </div>
              <div className="flex gap-3 items-center">
                <a href={urlVisor} target="_blank" rel="noopener noreferrer" className="text-[#1A6BFF] text-xs font-medium hover:underline">
                  Abrir en nueva pestaña →
                </a>
                <button
                  onClick={() => { setNotaVisor(null); setUrlVisor(null); }}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold"
                >
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