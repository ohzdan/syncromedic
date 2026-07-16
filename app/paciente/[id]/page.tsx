"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'

export default function ExpedientePaciente() {
  const [paciente, setPaciente] = useState<any>(null);
  const [rol, setRol] = useState<Rol>('familia');
  const [permisosEscuela, setPermisosEscuela] = useState({ puede_ver_medicamentos: false, puede_ver_timeline: false });
  const [loading, setLoading] = useState(true);
  const [editandoApodo, setEditandoApodo] = useState(false);
  const [apodoInput, setApodoInput] = useState("");
  const [guardandoApodo, setGuardandoApodo] = useState(false);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    async function cargarPaciente() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      const rolActual = (userData?.role || user.user_metadata?.role || 'familia') as Rol;
      setRol(rolActual);

      if (rolActual === 'escuela') {
        const { data: acceso } = await supabase
          .from('expediente_accesos')
          .select('puede_ver_medicamentos, puede_ver_timeline')
          .eq('paciente_id', params.id)
          .eq('usuario_id', user.id)
          .eq('estado', 'activo')
          .single();

        setPermisosEscuela({
          puede_ver_medicamentos: acceso?.puede_ver_medicamentos ?? false,
          puede_ver_timeline: acceso?.puede_ver_timeline ?? false,
        });
      }

      const { data } = await supabase
        .from("pacientes").select("*").eq("id", params.id).single();
      if (!data) { router.push("/dashboard"); return; }
      setPaciente(data);
      setApodoInput(data.apodo || "");
      setLoading(false);
    }
    cargarPaciente();
  }, []);

  function calcularEdad(fecha: string) {
    const hoy = new Date();
    const nac = new Date(fecha);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  }

  async function guardarApodo() {
    setGuardandoApodo(true);
    const nuevoApodo = apodoInput.trim() || null;
    const { error } = await supabase
      .from('pacientes')
      .update({ apodo: nuevoApodo })
      .eq('id', params.id);

    if (!error) {
      setPaciente((prev: any) => ({ ...prev, apodo: nuevoApodo }));
      setEditandoApodo(false);
    } else {
      alert('No se pudo guardar el apodo. Intenta de nuevo.');
    }
    setGuardandoApodo(false);
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando expediente...</p>
    </main>
  );

  const esFamilia = rol === 'familia';
  const esEscuela = rol === 'escuela';
  const esProfesionalClinico = !esFamilia && !esEscuela; // medico, terapeuta, centro_terapias, admin

  const escuelaVeMedicamentos = esEscuela && permisosEscuela.puede_ver_medicamentos;
  const escuelaVeTimeline = esEscuela && permisosEscuela.puede_ver_timeline;

  const nombreParaEquipo = paciente.apodo || paciente.nombre;
  const puedeVerExpedienteCompleto = esFamilia || esProfesionalClinico;
  const puedeVerTimeline = esFamilia || esProfesionalClinico || escuelaVeTimeline;

  // Tarjeta compacta: icono + título en móvil (grid 3 columnas), con descripción visible desde sm+
  function TarjetaCompacta({ href, emoji, titulo, descripcion }: { href: string; emoji: string; titulo: string; descripcion: string }) {
    return (
      <Link
        href={href}
        className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer flex flex-col items-center text-center sm:items-start sm:text-left no-underline"
      >
        <p className="text-xl sm:text-2xl mb-1 sm:mb-3">{emoji}</p>
        <h2 className="text-slate-900 font-semibold text-xs sm:text-base leading-tight mb-0 sm:mb-1">{titulo}</h2>
        <p className="hidden sm:block text-slate-500 text-sm">{descripcion}</p>
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </Link>
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 text-sm transition-colors">
          ← Regresar
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* Header unificado: datos, apodo, diagnóstico, alergias y acceso al expediente completo */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-50 flex items-center justify-center text-2xl sm:text-3xl flex-shrink-0">
              👤
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-slate-900 text-xl sm:text-2xl font-semibold">{paciente.nombre}</h1>
                {esFamilia && (
                  <Link
                    href={`/paciente/${params.id}/scouting?modo=editar`}
                    className="text-slate-400 hover:text-[#1A6BFF] text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    ✏️ Editar
                  </Link>
                )}
              </div>

              {esFamilia && editandoApodo ? (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <input
                    type="text"
                    autoFocus
                    value={apodoInput}
                    onChange={(e) => setApodoInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardarApodo(); if (e.key === 'Escape') { setApodoInput(paciente.apodo || ""); setEditandoApodo(false); } }}
                    placeholder="Apodo (ej: Sofi)"
                    className="border border-slate-200 rounded-lg px-2.5 py-1 text-sm text-slate-800 focus:outline-none focus:border-[#1A6BFF] transition-colors"
                  />
                  <button onClick={guardarApodo} disabled={guardandoApodo} className="text-[#1A6BFF] text-xs font-semibold disabled:opacity-50">
                    {guardandoApodo ? "Guardando..." : "Guardar"}
                  </button>
                  <button onClick={() => { setApodoInput(paciente.apodo || ""); setEditandoApodo(false); }} className="text-slate-400 text-xs">
                    Cancelar
                  </button>
                </div>
              ) : (
                <p className="text-slate-500 text-sm mt-1 flex items-center gap-2 flex-wrap">
                  {calcularEdad(paciente.fecha_nacimiento)} años · {paciente.sexo || "—"} · Sangre {paciente.tipo_sangre || "no especificada"}
                  {paciente.apodo && (
                    <span className="text-xs bg-blue-50 text-[#1A6BFF] px-2 py-0.5 rounded-full border border-blue-100">
                      "{paciente.apodo}"
                    </span>
                  )}
                  {esFamilia && (
                    <button onClick={() => setEditandoApodo(true)} className="text-slate-400 hover:text-[#1A6BFF] text-xs transition-colors">
                      {paciente.apodo ? "editar apodo" : "+ agregar apodo"}
                    </button>
                  )}
                </p>
              )}

              {paciente.diagnosticos_principales?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {paciente.diagnosticos_principales.map((dx: string, i: number) => (
                    <span key={i} className="text-xs bg-blue-50 text-[#1A6BFF] px-2 py-1 rounded-full border border-blue-100">
                      {dx}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {paciente.alergias?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-red-600 text-xs font-semibold mb-2">⚠️ Alergias conocidas</p>
              <div className="flex flex-wrap gap-2">
                {paciente.alergias.map((a: string, i: number) => (
                  <span key={i} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {puedeVerExpedienteCompleto && (
            <Link
              href={`/paciente/${params.id}/resumen`}
              className="mt-4 flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-[#1A6BFF] text-sm font-semibold py-2.5 rounded-xl transition-colors no-underline"
            >
              📄 Ver expediente completo →
            </Link>
          )}
        </div>

        {/* Historial / Timeline: lo más relevante, siempre arriba */}
        {puedeVerTimeline && (
          <Link
            href={`/paciente/${params.id}/timeline`}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-4 sm:mb-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer flex items-center gap-4 no-underline"
          >
            <p className="text-2xl sm:text-3xl flex-shrink-0">⏱️</p>
            <div>
              <h2 className="text-slate-900 font-semibold text-base sm:text-lg mb-0.5">Historial de {nombreParaEquipo}</h2>
              <p className="text-slate-500 text-xs sm:text-sm">Todo el historial cronológico del expediente, en un solo lugar</p>
            </div>
          </Link>
        )}

        {/* Grid compacta: 3 columnas en móvil, 2 desde sm+ */}
        <div className="grid grid-cols-3 sm:grid-cols-2 gap-3 sm:gap-4">

          {(esFamilia || esProfesionalClinico) && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/bitacora/sueno`}
              emoji="😴"
              titulo="Diario de sueño"
              descripcion="Horas dormidas, despertares nocturnos e historial de 30 días"
            />
          )}

          {(esFamilia || esProfesionalClinico) && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/bitacora/evacuaciones`}
              emoji="💧"
              titulo="Evacuaciones"
              descripcion="Galería de fotos, consistencia e historial de 30 días"
            />
          )}

          {esFamilia && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/equipo`}
              emoji="🩺"
              titulo={`Equipo de ${nombreParaEquipo}`}
              descripcion="Doctores, terapeutas y escuela vinculados"
            />
          )}

          {/* Unificado por rol: familia ve Bitácora familiar, equipo clínico ve Notas clínicas */}
          {esFamilia && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/bitacora-familiar`}
              emoji="📝"
              titulo="Bitácora familiar"
              descripcion="Tu registro libre del día a día"
            />
          )}
          {esProfesionalClinico && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/notas`}
              emoji="📋"
              titulo="Notas clínicas"
              descripcion="Consultas, sesiones y reportes — puedes agregar y firmar"
            />
          )}

          {esProfesionalClinico && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/medicamentos`}
              emoji="💊"
              titulo="Medicamentos"
              descripcion="Medicamentos activos (solo lectura)"
            />
          )}

          {esFamilia && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/medicamentos`}
              emoji="💊"
              titulo="Medicamentos"
              descripcion="Medicamentos activos y quién los indicó"
            />
          )}

          {escuelaVeMedicamentos && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/medicamentos`}
              emoji="💊"
              titulo="Medicamentos"
              descripcion="Medicamentos activos (solo lectura)"
            />
          )}

          {(esFamilia || esProfesionalClinico) && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/documentos`}
              emoji="📁"
              titulo="Documentos"
              descripcion="Estudios, análisis y recetas"
            />
          )}

          {(esFamilia || esEscuela) && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/recomendaciones`}
              emoji="📝"
              titulo="Recomendaciones"
              descripcion="Indicaciones del equipo para el entorno escolar"
            />
          )}

        </div>

        {esEscuela && (
          <p className="text-slate-400 text-xs mt-6 text-center">
            Como escuela, tu acceso está limitado a las recomendaciones para el entorno escolar{(permisosEscuela.puede_ver_medicamentos || permisosEscuela.puede_ver_timeline) ? ', más lo que la familia te haya habilitado.' : '.'}
          </p>
        )}

      </div>
    </main>
  );
}