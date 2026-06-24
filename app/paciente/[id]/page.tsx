"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function ExpedientePaciente() {
  const [paciente, setPaciente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();

  useEffect(() => {
    async function cargarPaciente() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      const { data } = await supabase
        .from("pacientes").select("*").eq("id", params.id).single();
      if (!data) { router.push("/dashboard"); return; }
      setPaciente(data);
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

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando expediente...</p>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </div>
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 text-sm transition-colors">
          ← Regresar
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6 flex items-center gap-6 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-3xl">
            👤
          </div>
          <div className="flex-1">
            <h1 className="text-slate-900 text-2xl font-semibold">{paciente.nombre}</h1>
            <p className="text-slate-500 text-sm mt-1">
              {calcularEdad(paciente.fecha_nacimiento)} años · {paciente.sexo || "—"} · Sangre {paciente.tipo_sangre || "no especificada"}
            </p>
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
          <Link
            href={`/paciente/${params.id}/scouting?modo=editar`}
            className="text-slate-400 hover:text-[#1A6BFF] text-xs font-medium transition-colors whitespace-nowrap"
          >
            ✏️ Editar perfil
          </Link>
        </div>

        {paciente.alergias?.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
            <p className="text-red-600 text-sm font-semibold mb-2">⚠️ Alergias conocidas</p>
            <div className="flex flex-wrap gap-2">
              {paciente.alergias.map((a: string, i: number) => (
                <span key={i} className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <Link href={`/paciente/${params.id}/equipo`} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer block no-underline">
            <p className="text-2xl mb-3">🩺</p>
            <h2 className="text-slate-900 font-semibold mb-1">Equipo médico</h2>
            <p className="text-slate-500 text-sm">Doctores, terapeutas y escuela vinculados</p>
            <p className="text-[#1A6BFF] text-xs font-semibold mt-3">+ Invitar profesional →</p>
          </Link>

          <Link href={`/paciente/${params.id}/notas`} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer block no-underline">
            <p className="text-2xl mb-3">📋</p>
            <h2 className="text-slate-900 font-semibold mb-1">Notas clínicas</h2>
            <p className="text-slate-500 text-sm">Consultas, sesiones y reportes del equipo</p>
          </Link>

          <Link href={`/paciente/${params.id}/medicamentos`} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer block no-underline">
            <p className="text-2xl mb-3">💊</p>
            <h2 className="text-slate-900 font-semibold mb-1">Medicamentos</h2>
            <p className="text-slate-500 text-sm">Medicamentos activos y quién los indicó</p>
          </Link>

          <Link href={`/paciente/${params.id}/documentos`} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer block no-underline">
            <p className="text-2xl mb-3">📁</p>
            <h2 className="text-slate-900 font-semibold mb-1">Documentos</h2>
            <p className="text-slate-500 text-sm">Estudios, análisis y recetas</p>
          </Link>

          <Link href={`/paciente/${params.id}/timeline`} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer block no-underline">
            <p className="text-2xl mb-3">⏱️</p>
            <h2 className="text-slate-900 font-semibold mb-1">Timeline médico</h2>
            <p className="text-slate-500 text-sm">Historial cronológico de todos los eventos del expediente</p>
          </Link>

          <Link href={`/paciente/${params.id}/recomendaciones`} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer block no-underline">
            <p className="text-2xl mb-3">📝</p>
            <h2 className="text-slate-900 font-semibold mb-1">Recomendaciones para la escuela</h2>
            <p className="text-slate-500 text-sm">Indicaciones del equipo médico y terapéutico para el entorno escolar</p>
          </Link>

        </div>
      </div>
    </main>
  );
}