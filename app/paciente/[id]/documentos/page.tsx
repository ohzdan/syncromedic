"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const CATEGORIAS = [
  { id: "laboratorio", label: "Estudio de laboratorio", emoji: "🧪" },
  { id: "imagen", label: "Estudio de imagen", emoji: "🔬" },
  { id: "receta", label: "Receta", emoji: "💊" },
  { id: "otro", label: "Otro", emoji: "📄" },
];

type Documento = {
  id: string;
  nombre: string;
  categoria: string;
  archivo_url: string;
  archivo_path: string;
  tipo_archivo: string;
  created_at: string;
};

export default function DocumentosPage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [paciente, setPaciente] = useState<any>(null);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [rol, setRol] = useState("");

  // Modal nuevo documento
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // Visor
  const [docVisor, setDocVisor] = useState<Documento | null>(null);
  const [urlVisor, setUrlVisor] = useState<string | null>(null);

  // Filtro
  const [filtro, setFiltro] = useState("todos");

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single();
    setRol(userData?.role || "");

    const { data: pac } = await supabase.from("pacientes").select("id, nombre").eq("id", pacienteId).single();
    setPaciente(pac);

    await cargarDocumentos();
    setLoading(false);
  }

  async function cargarDocumentos() {
    const { data } = await supabase
      .from("documentos")
      .select("*")
      .eq("paciente_id", pacienteId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setDocumentos(data || []);
  }

  function onArchivoSeleccionado(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivo(file);
    if (!nombre) setNombre(file.name.replace(/\.[^/.]+$/, ""));
    if (file.type.startsWith("image/")) {
      setPreview(URL.createObjectURL(file));
    } else {
      setPreview(null);
    }
  }

  async function subirDocumento() {
    if (!archivo || !nombre || !categoria) {
      setError("Completa todos los campos y selecciona un archivo.");
      return;
    }
    setSubiendo(true);
    setError("");

    const ext = archivo.name.split(".").pop();
    const path = `${pacienteId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("documentos")
      .upload(path, archivo);

    if (uploadError) {
      setError("Error al subir el archivo. Intenta de nuevo.");
      setSubiendo(false);
      return;
    }

    const { error: dbError } = await supabase.from("documentos").insert({
      paciente_id: pacienteId,
      nombre,
      categoria,
      archivo_path: path,
      archivo_url: path,
      tipo_archivo: archivo.type,
    });

    if (dbError) {
      setError("Error al guardar el documento.");
      setSubiendo(false);
      return;
    }

    setModalAbierto(false);
    setNombre(""); setCategoria(""); setArchivo(null); setPreview(null);
    await cargarDocumentos();
    setSubiendo(false);
  }

  async function abrirDocumento(doc: Documento) {
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(doc.archivo_path, 60);
    if (data?.signedUrl) {
      setDocVisor(doc);
      setUrlVisor(data.signedUrl);
    }
  }

  async function eliminarDocumento(doc: Documento) {
    if (!confirm(`¿Eliminar "${doc.nombre}"?`)) return;
    await supabase.storage.from("documentos").remove([doc.archivo_path]);
    await supabase.from("documentos").update({ deleted_at: new Date().toISOString() }).eq("id", doc.id);
    await cargarDocumentos();
  }

  const esFamilia = rol === "familia";
  const docsFiltrados = filtro === "todos" ? documentos : documentos.filter(d => d.categoria === filtro);

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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-slate-800 text-2xl font-bold">Documentos</h1>
            <p className="text-slate-500 text-sm mt-0.5">{paciente?.nombre}</p>
          </div>
          {esFamilia && (
            <button
              onClick={() => setModalAbierto(true)}
              className="bg-[#1A6BFF] hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              + Subir documento
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {[{ id: "todos", label: "Todos", emoji: "📁" }, ...CATEGORIAS].map(c => (
            <button
              key={c.id}
              onClick={() => setFiltro(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filtro === c.id ? "bg-[#1A6BFF] border-[#1A6BFF] text-white" : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"}`}
            >
              {c.emoji} {c.label}
            </button>
          ))}
        </div>

        {/* Lista de documentos */}
        {docsFiltrados.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="text-4xl mb-3">📂</div>
            <p className="text-slate-500 text-sm">
              {filtro === "todos" ? "Aún no hay documentos en este expediente." : "No hay documentos en esta categoría."}
            </p>
            {esFamilia && (
              <button onClick={() => setModalAbierto(true)} className="mt-4 text-[#1A6BFF] text-sm hover:underline">
                Subir el primero →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {docsFiltrados.map(doc => {
              const cat = CATEGORIAS.find(c => c.id === doc.categoria);
              const esImagen = doc.tipo_archivo?.startsWith("image/");
              const fecha = new Date(doc.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
              return (
                <div key={doc.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {esImagen ? "🖼️" : cat?.emoji || "📄"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 text-sm font-semibold truncate">{doc.nombre}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{cat?.label || "Otro"} · {fecha}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => abrirDocumento(doc)}
                      className="text-[#1A6BFF] text-xs font-medium hover:underline px-3 py-1.5 border border-[#1A6BFF] rounded-lg transition-colors hover:bg-blue-50"
                    >
                      Ver
                    </button>
                    {esFamilia && (
                      <button
                        onClick={() => eliminarDocumento(doc)}
                        className="text-red-400 text-xs font-medium hover:underline px-3 py-1.5 border border-red-200 rounded-lg transition-colors hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal subir documento */}
      {modalAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-slate-800 text-lg font-bold mb-5">Subir documento</h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Nombre del documento *</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Análisis de sangre enero 2025"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]"
                />
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-2 block">Categoría *</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIAS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCategoria(c.id)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors text-left ${categoria === c.id ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block">Archivo *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center cursor-pointer hover:border-[#1A6BFF] transition-colors"
                >
                  {preview ? (
                    <img src={preview} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
                  ) : archivo ? (
                    <div>
                      <div className="text-3xl mb-2">📄</div>
                      <p className="text-slate-600 text-sm font-medium">{archivo.name}</p>
                      <p className="text-slate-400 text-xs mt-1">{(archivo.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl mb-2">📎</div>
                      <p className="text-slate-500 text-sm">Toca para seleccionar</p>
                      <p className="text-slate-400 text-xs mt-1">PDF, JPG o PNG · máx 10 MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={onArchivoSeleccionado}
                  className="hidden"
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => { setModalAbierto(false); setNombre(""); setCategoria(""); setArchivo(null); setPreview(null); setError(""); }}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={subirDocumento}
                  disabled={subiendo || !archivo || !nombre || !categoria}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                >
                  {subiendo ? "Subiendo..." : "Subir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visor de documento */}
      {docVisor && urlVisor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-slate-800 text-sm font-semibold">{docVisor.nombre}</p>
                <p className="text-slate-400 text-xs">{CATEGORIAS.find(c => c.id === docVisor.categoria)?.label}</p>
              </div>
              <div className="flex gap-3 items-center">
                <a href={urlVisor} target="_blank" rel="noopener noreferrer" className="text-[#1A6BFF] text-xs font-medium hover:underline">
                  Abrir en nueva pestaña →
                </a>
                <button onClick={() => { setDocVisor(null); setUrlVisor(null); }} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {docVisor.tipo_archivo?.startsWith("image/") ? (
                <img src={urlVisor} alt={docVisor.nombre} className="max-w-full mx-auto rounded-lg" />
              ) : (
                <iframe src={urlVisor} className="w-full h-[60vh] rounded-lg border border-slate-100" />
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}