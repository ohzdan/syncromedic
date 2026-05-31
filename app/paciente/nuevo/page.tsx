"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NuevoPaciente() {
  const [nombre, setNombre] = useState("");
  const [fechaNacimiento, setFechaNacimiento] = useState("");
  const [sexo, setSexo] = useState("");
  const [tipoSangre, setTipoSangre] = useState("");
  const [alergias, setAlergias] = useState("");
  const [diagnosticos, setDiagnosticos] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  async function handleGuardar() {
    setLoading(true);
    setError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { error } = await supabase.from("pacientes").insert({
      familia_id: user.id,
      nombre,
      fecha_nacimiento: fechaNacimiento,
      sexo: sexo || null,
      tipo_sangre: tipoSangre || null,
      alergias: alergias ? alergias.split(",").map(a => a.trim()) : [],
      diagnosticos_principales: diagnosticos ? diagnosticos.split(",").map(d => d.trim()) : [],
    });

    if (error) {
      setError("Ocurrió un error al guardar. Intenta de nuevo.");
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-[#0a1628]">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </div>
        <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm transition-colors">
          Cancelar
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-white text-2xl font-semibold">Nuevo paciente</h1>
          <p className="text-slate-400 text-sm mt-1">
            Registra los datos de tu hijo para crear su expediente
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col gap-5">

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Nombre completo *</label>
            <input
              type="text"
              placeholder="Ej: Sofía García"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-[#00C97A] transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Fecha de nacimiento *</label>
            <input
              type="date"
              value={fechaNacimiento}
              onChange={(e) => setFechaNacimiento(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00C97A] transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Sexo</label>
            <select
              value={sexo}
              onChange={(e) => setSexo(e.target.value)}
              className="w-full bg-[#0a1628] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00C97A] transition-colors"
            >
              <option value="">Seleccionar</option>
              <option value="masculino">Masculino</option>
              <option value="femenino">Femenino</option>
              <option value="otro">Otro</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Tipo de sangre</label>
            <select
              value={tipoSangre}
              onChange={(e) => setTipoSangre(e.target.value)}
              className="w-full bg-[#0a1628] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#00C97A] transition-colors"
            >
              <option value="">No sé / No especificar</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Alergias conocidas</label>
            <input
              type="text"
              placeholder="Ej: penicilina, látex (separadas por coma)"
              value={alergias}
              onChange={(e) => setAlergias(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-[#00C97A] transition-colors"
            />
          </div>

          <div>
            <label className="text-slate-300 text-sm mb-1 block">Diagnósticos principales</label>
            <input
              type="text"
              placeholder="Ej: Autismo nivel 2, TDAH (separados por coma)"
              value={diagnosticos}
              onChange={(e) => setDiagnosticos(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-[#00C97A] transition-colors"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            onClick={handleGuardar}
            disabled={loading || !nombre || !fechaNacimiento}
            className="w-full bg-[#00C97A] hover:bg-[#00b36c] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
          >
            {loading ? "Guardando..." : "Crear expediente"}
          </button>
        </div>
      </div>
    </main>
  );
}