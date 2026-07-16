"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Entrada = {
  id: string;
  fecha: string;
  contenido: string;
  imagen_path: string | null;
  created_at: string;
  autor_id: string;
};

export default function BitacoraFamiliarPage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [paciente, setPaciente] = useState<any>(null);
  const [usuario, setUsuario] = useState<any>(null);
  const [entradas, setEntradas] = useState<Entrada[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [contenido, setContenido] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [entradaVisor, setEntradaVisor] = useState<Entrada | null>(null);
  const [urlVisor, setUrlVisor] = useState<string | null>(null);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: userData } = await supabase
      .from("users")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    setUsuario({ ...userData, id: user.id });

    const { data: pac } = await supabase
      .from("pacientes")
      .select("id, nombre, apodo")
      .eq("id", pacienteId)
      .single();
    setPaciente(pac);

    await cargarEntradas();
    setLoading(false);
  }

  async function cargarEntradas() {
    const { data } = await supabase
      .from("bitacora_familiar")
      .select("*")
      .eq("paciente_id", pacienteId)
      .is("deleted_at", null)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    setEntradas(data || []);
  }

  function limpiarFormulario() {
    setContenido(""); setImagen(null); setPreview(null); setError("");
    setFecha(new Date().toISOString().split("T")[0]);
  }

  function onImagenSeleccionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagen(file);
    setPreview(URL.createObjectURL(file));
  }

  async function guardarEntrada() {
    if (!contenido.trim()) {
      setError("Escribe algo antes de guardar.");
      return;
    }
    setGuardando(true);
    setError("");

    let imagenPath = null;
    if (imagen) {
      const ext = imagen.name.split(".").pop();
      const path = `${pacienteId}/bitacora-familiar/${Date.now()}.${ext}`;
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

    const { error: dbError } = await supabase.from("bitacora_familiar").insert({
      paciente_id: pacienteId,
      autor_id: usuario.id,
      fecha,
      contenido: contenido.trim(),
      imagen_path: imagenPath,
    });

    if (dbError) {
      setError(dbError.message);
      setGuardando(false);
      return;
    }

    setModalAbierto(false);
    limpiarFormulario();
    await cargarEntradas();
    setGuardando(false);
  }

  async function eliminarEntrada(id: string) {
    if (!confirm("¿Eliminar esta entrada de la bitácora?")) return;
    await supabase
      .from("bitacora_familiar")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    await cargarEntradas();
  }

  async function abrirImagen(entrada: Entrada) {
    if (!entrada.imagen_path) return;
    const { data } = await supabase.storage
      .from("documentos")
      .createSignedUrl(entrada.imagen_path, 60);
    if (data?.signedUrl) {
      setEntradaVisor(entrada);
      setUrlVisor(data.signedUrl);
    }
  }

  function formatFecha(f: string) {
    return new Date(f + "T12:00:00").toLocaleDateString("es-MX", {
      day: "numeric", month: "long", year: "numeric"
    });
  }

  const esFamilia = usuario?.role === "familia";
  const nombreParaTitulo = paciente?.apodo || paciente?.nombre;

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
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-slate-800 text-2xl font-bold">Bitácora familiar</h1>
            <p className="text-slate-500 text-sm mt-0.5">Registro libre de {nombreParaTitulo}</p>
          </div>
          {esFamilia && (
            <button
              onClick={() => { limpiarFormulario(); setModalAbierto(true); }}
              className="bg-[#1A6BFF] hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              + Nueva entrada
            </button>
          )}
        </div>

        <p className="text-slate-400 text-xs mb-6">
          Este es tu espacio para anotar lo que observas día a día. Es distinto de las notas clínicas del equipo médico — aquí no se requiere formato SOAP ni firma.
        </p>

        {entradas.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-slate-500 text-sm">Aún no hay entradas en la bitácora.</p>
            {esFamilia && (
              <button
                onClick={() => { limpiarFormulario(); setModalAbierto(true); }}
                className="mt-4 text-[#1A6BFF] text-sm hover:underline"
              >
                Agregar la primera →
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {entradas.map((entrada) => (
              <div key={entrada.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-slate-400 text-xs font-medium">{formatFecha(entrada.fecha)}</p>
                  {esFamilia && entrada.autor_id === usuario.id && (
                    <button
                      onClick={() => eliminarEntrada(entrada.id)}
                      className="text-red-300 hover:text-red-500 text-xs transition-colors"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <p className="text-slate-700 text-sm whitespace-pre-wrap mt-2">{entrada.contenido}</p>
                {entrada.imagen_path && (
                  <button
                    onClick={() => abrirImagen(entrada)}
                    className="flex items-center gap-2 text-[#1A6BFF] text-xs font-medium hover:underline mt-3"
                  >
                    🖼️ Ver imagen adjunta →
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal nueva entrada */}
      {modalAbierto && esFamilia && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-slate-800 text-lg font-bold mb-5">Nueva entrada de bitácora</h2>
            <div className="flex flex-col gap-4">

              <div>
                <label className="text-slate-500 text-xs mb-1 block font-medium">Fecha *</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>

              <div>
                <label className="text-slate-500 text-xs mb-1 block font-medium">¿Qué quieres anotar? *</label>
                <textarea value={contenido} onChange={e => setContenido(e.target.value)}
                  placeholder="Hoy notamos que..." rows={5}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
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
                <button onClick={guardarEntrada} disabled={guardando}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                  {guardando ? "Guardando..." : "Guardar entrada"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visor imagen */}
      {entradaVisor && urlVisor && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-slate-800 text-sm font-semibold">{formatFecha(entradaVisor.fecha)}</p>
              <div className="flex gap-3 items-center">
                <a href={urlVisor} target="_blank" rel="noopener noreferrer"
                  className="text-[#1A6BFF] text-xs font-medium hover:underline">
                  Abrir en nueva pestaña →
                </a>
                <button onClick={() => { setEntradaVisor(null); setUrlVisor(null); }}
                  className="text-slate-400 hover:text-slate-600 text-xl font-bold">
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <img src={urlVisor} alt="entrada" className="max-w-full mx-auto rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}