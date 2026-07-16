"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NuevoPaciente() {
  const [nombre, setNombre] = useState("");
  const [apodo, setApodo] = useState("");
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [anio, setAnio] = useState("");
  const [sexo, setSexo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 30 }, (_, i) => anioActual - i);
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);

  async function handleGuardar() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const fechaNacimiento = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

    const { data, error } = await supabase.from("pacientes").insert({
      familia_id: user.id,
      nombre,
      apodo: apodo.trim() || null,
      fecha_nacimiento: fechaNacimiento,
      sexo: sexo || null,
    }).select();

    if (error || !data || data.length === 0) {
      setError("Ocurrió un error al guardar. Intenta de nuevo.");
    } else {
      router.push(`/paciente/${data[0].id}/scouting`);
    }
    setLoading(false);
  }

  const fechaCompleta = dia && mes && anio;

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
        <Link href="/dashboard" className="text-slate-400 hover:text-slate-600 text-sm transition-colors">
          Cancelar
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-slate-800 text-2xl font-semibold">Nuevo paciente</h1>
          <p className="text-slate-500 text-sm mt-1">
            Empieza con los datos básicos. Después completaremos el perfil paso a paso.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col gap-5">

          <div>
            <label className="text-slate-600 text-sm mb-1 block">Nombre completo *</label>
            <input
              type="text"
              placeholder="Ej: Sofía García"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-600 text-sm mb-1 block">Apodo (opcional)</label>
            <input
              type="text"
              placeholder="Ej: Sofi"
              value={apodo}
              onChange={(e) => setApodo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
            />
            <p className="text-slate-400 text-xs mt-1">Se usa para personalizar secciones como "Equipo de {"{apodo}"}"</p>
          </div>

          <div>
            <label className="text-slate-600 text-sm mb-2 block">Fecha de nacimiento *</label>
            <div className="grid grid-cols-3 gap-3">
              <select
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
              >
                <option value="">Día</option>
                {dias.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
              >
                <option value="">Mes</option>
                {meses.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>

              <select
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
              >
                <option value="">Año</option>
                {anios.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-600 text-sm mb-1 block">Sexo</label>
            <select
              value={sexo}
              onChange={(e) => setSexo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
            >
              <option value="">Seleccionar</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleGuardar}
            disabled={loading || !nombre || !fechaCompleta}
            className="w-full bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
          >
            {loading ? "Guardando..." : "Continuar →"}
          </button>
        </div>
      </div>
    </main>
  );
}