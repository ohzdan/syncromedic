"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import BottomNav from "@/components/BottomNav";

type TipoDatoCampo = 'escala_1_5' | 'numero' | 'hora_unica' | 'rango_horas' | 'si_no' | 'texto_corto';

type CampoPaciente = {
  id: string;
  catalogo_slug: string | null;
  nombre: string;
  tipo_dato: TipoDatoCampo;
  permite_foto: boolean;
  icono: string | null;
  activo: boolean;
  es_personalizado: boolean;
};

/**
 * Catálogo built-in ampliado. Si algún día se agrega un campo built-in nuevo,
 * basta con agregarlo aquí — se sembrará solo para pacientes que no lo tengan.
 */
const CATALOGO_BUILTIN: { slug: string; nombre: string; tipo_dato: TipoDatoCampo; icono: string }[] = [
  { slug: 'convulsiones', nombre: 'Convulsiones', tipo_dato: 'hora_unica', icono: '⚡' },
  { slug: 'medicamento_cumplimiento', nombre: 'Medicamento (cumplimiento)', tipo_dato: 'si_no', icono: '💊' },
  { slug: 'conducta', nombre: 'Conducta', tipo_dato: 'escala_1_5', icono: '🙂' },
  { slug: 'dolor', nombre: 'Dolor', tipo_dato: 'escala_1_5', icono: '⚠️' },
  { slug: 'alimentacion', nombre: 'Alimentación', tipo_dato: 'texto_corto', icono: '🍽️' },
  { slug: 'movilidad', nombre: 'Movilidad', tipo_dato: 'escala_1_5', icono: '🦵' },
  { slug: 'comunicacion', nombre: 'Comunicación', tipo_dato: 'texto_corto', icono: '💬' },
];

const TIPOS_DATO: { value: TipoDatoCampo; label: string }[] = [
  { value: 'escala_1_5', label: 'Escala 1-5' },
  { value: 'numero', label: 'Número' },
  { value: 'hora_unica', label: 'Hora única' },
  { value: 'rango_horas', label: 'Rango de horas' },
  { value: 'si_no', label: 'Sí / No' },
  { value: 'texto_corto', label: 'Texto corto' },
];

const ICONOS_DISPONIBLES = ['📊', '🔋', '❤️', '🔥', '🧠', '🩹', '👁️', '🦷'];

export default function PersonalizarBitacora() {
  const [nombreParaEquipo, setNombreParaEquipo] = useState("");
  const [campos, setCampos] = useState<CampoPaciente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardandoToggle, setGuardandoToggle] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState<TipoDatoCampo>('escala_1_5');
  const [nuevoPermiteFoto, setNuevoPermiteFoto] = useState(false);
  const [nuevoIcono, setNuevoIcono] = useState(ICONOS_DISPONIBLES[0]);
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);
  const [errorNuevo, setErrorNuevo] = useState("");

  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const pacienteId = params.id as string;

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: paciente } = await supabase
      .from('pacientes')
      .select('nombre, apodo')
      .eq('id', pacienteId)
      .single();
    if (!paciente) { router.push('/dashboard'); return; }
    setNombreParaEquipo(paciente.apodo || paciente.nombre);

    let { data: existentes } = await supabase
      .from('bitacora_campos_paciente')
      .select('id, catalogo_slug, nombre, tipo_dato, permite_foto, icono, activo, es_personalizado')
      .eq('paciente_id', pacienteId)
      .is('deleted_at', null);

    const yaTieneBuiltin = new Set((existentes || []).filter(c => c.catalogo_slug).map(c => c.catalogo_slug));
    const faltantes = CATALOGO_BUILTIN.filter(c => !yaTieneBuiltin.has(c.slug));

    if (faltantes.length > 0) {
      await supabase.from('bitacora_campos_paciente').insert(
        faltantes.map(c => ({
          paciente_id: pacienteId,
          catalogo_slug: c.slug,
          nombre: c.nombre,
          tipo_dato: c.tipo_dato,
          icono: c.icono,
          permite_foto: false,
          activo: false,
          es_personalizado: false,
        }))
      );

      const { data: recargados } = await supabase
        .from('bitacora_campos_paciente')
        .select('id, catalogo_slug, nombre, tipo_dato, permite_foto, icono, activo, es_personalizado')
        .eq('paciente_id', pacienteId)
        .is('deleted_at', null);
      existentes = recargados;
    }

    setCampos((existentes || []) as CampoPaciente[]);
    setCargando(false);
  }

  async function alternarActivo(campo: CampoPaciente) {
    setGuardandoToggle(campo.id);
    const { error } = await supabase
      .from('bitacora_campos_paciente')
      .update({ activo: !campo.activo })
      .eq('id', campo.id);

    if (!error) {
      setCampos(prev => prev.map(c => c.id === campo.id ? { ...c, activo: !c.activo } : c));
    }
    setGuardandoToggle(null);
  }

  async function crearPersonalizado() {
    setErrorNuevo("");
    if (!nuevoNombre.trim()) { setErrorNuevo("Ponle un nombre a tu campo."); return; }
    setGuardandoNuevo(true);

    const { data, error } = await supabase.from('bitacora_campos_paciente').insert({
      paciente_id: pacienteId,
      catalogo_slug: null,
      nombre: nuevoNombre.trim(),
      tipo_dato: nuevoTipo,
      permite_foto: nuevoPermiteFoto,
      icono: nuevoIcono,
      activo: true,
      es_personalizado: true,
    }).select().single();

    if (error || !data) {
      setErrorNuevo("No se pudo crear el campo. Intenta de nuevo.");
      setGuardandoNuevo(false);
      return;
    }

    setCampos(prev => [...prev, data as CampoPaciente]);
    setNuevoNombre("");
    setNuevoTipo('escala_1_5');
    setNuevoPermiteFoto(false);
    setNuevoIcono(ICONOS_DISPONIBLES[0]);
    setFormAbierto(false);
    setGuardandoNuevo(false);
  }

  async function eliminarPersonalizado(campo: CampoPaciente) {
    if (!confirm(`¿Eliminar "${campo.nombre}"? Los registros ya guardados no se borran, solo dejará de aparecer.`)) return;
    const { error } = await supabase
      .from('bitacora_campos_paciente')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', campo.id);
    if (!error) {
      setCampos(prev => prev.filter(c => c.id !== campo.id));
    }
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  const camposCatalogo = campos.filter(c => !c.es_personalizado);
  const camposPersonalizados = campos.filter(c => c.es_personalizado);

  return (
    <main className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <button onClick={() => router.back()} className="text-slate-400 text-sm mb-3">← Atrás</button>
        <h1 className="text-slate-900 text-xl font-semibold mb-1">Personalizar bitácora</h1>
        <p className="text-slate-400 text-sm mb-6">Activa lo que quieras registrar para {nombreParaEquipo}</p>

        <div className="bg-slate-50 rounded-2xl overflow-hidden mb-6">
          {camposCatalogo.map(campo => (
            <div key={campo.id} className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 last:border-b-0">
              <span className="text-sm text-slate-800 flex items-center gap-2.5">
                <span className="text-base">{campo.icono}</span> {campo.nombre}
              </span>
              <button
                onClick={() => alternarActivo(campo)}
                disabled={guardandoToggle === campo.id}
                className={`w-10 h-6 rounded-full relative transition-colors disabled:opacity-50 ${campo.activo ? "bg-[#1A6BFF]" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${campo.activo ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </button>
            </div>
          ))}
        </div>

        {camposPersonalizados.length > 0 && (
          <div className="mb-4">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Tus campos personalizados</p>
            <div className="bg-slate-50 rounded-2xl overflow-hidden">
              {camposPersonalizados.map(campo => (
                <div key={campo.id} className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 last:border-b-0">
                  <span className="text-sm text-slate-800 flex items-center gap-2.5">
                    <span className="text-base">{campo.icono}</span> {campo.nombre}
                    <span className="text-slate-400 text-[10px]">{TIPOS_DATO.find(t => t.value === campo.tipo_dato)?.label}</span>
                  </span>
                  <button onClick={() => eliminarPersonalizado(campo)} className="text-red-400 text-xs font-medium">
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!formAbierto ? (
          <button
            onClick={() => setFormAbierto(true)}
            className="w-full border border-dashed border-blue-200 bg-blue-50/50 rounded-2xl p-3.5 flex items-center gap-2.5 text-[#1A6BFF] text-sm font-medium"
          >
            <span className="text-lg">➕</span> Crear campo personalizado
          </button>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-slate-400 text-[11px] uppercase tracking-wide mb-3">Nuevo campo personalizado</p>

            <label className="text-slate-500 text-xs block mb-1">Nombre</label>
            <input
              type="text"
              value={nuevoNombre}
              onChange={e => setNuevoNombre(e.target.value)}
              placeholder="Ej. Nivel de energía"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm mb-4 focus:outline-none focus:border-[#1A6BFF]"
            />

            <label className="text-slate-500 text-xs block mb-2">Tipo de dato</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {TIPOS_DATO.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setNuevoTipo(t.value)}
                  className={`py-2 rounded-xl text-xs font-medium transition-colors ${nuevoTipo === t.value ? "bg-blue-50 text-[#1A6BFF] border border-[#1A6BFF]" : "bg-white text-slate-600 border border-slate-200"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span>📷</span>
                <div>
                  <p className="text-sm text-slate-800">Permitir foto</p>
                  <p className="text-slate-400 text-[11px]">Adjuntar evidencia fotográfica</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setNuevoPermiteFoto(!nuevoPermiteFoto)}
                className={`w-10 h-6 rounded-full relative flex-shrink-0 transition-colors ${nuevoPermiteFoto ? "bg-[#1A6BFF]" : "bg-slate-200"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${nuevoPermiteFoto ? "translate-x-[18px]" : "translate-x-0.5"}`} />
              </button>
            </div>

            <label className="text-slate-500 text-xs block mb-2">Icono</label>
            <div className="flex gap-2 mb-4 flex-wrap">
              {ICONOS_DISPONIBLES.map(icono => (
                <button
                  key={icono}
                  type="button"
                  onClick={() => setNuevoIcono(icono)}
                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-base ${nuevoIcono === icono ? "bg-blue-50 border border-[#1A6BFF]" : "bg-white border border-slate-200"}`}
                >
                  {icono}
                </button>
              ))}
            </div>

            {errorNuevo && <p className="text-red-500 text-xs mb-3">{errorNuevo}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => { setFormAbierto(false); setErrorNuevo(""); }}
                className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={crearPersonalizado}
                disabled={guardandoNuevo}
                className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl"
              >
                {guardandoNuevo ? "Guardando..." : "Crear campo"}
              </button>
            </div>
          </div>
        )}
      </div>

      <BottomNav pacienteId={pacienteId} activo="ajustes" />
    </main>
  );
}