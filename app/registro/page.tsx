"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Registro() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleRegistro() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: nombre, role: "familia" } }
    });
    if (error) {
      setError("Ocurrió un error al crear tu cuenta. Intenta de nuevo.");
    } else {
      router.push("/consentimiento");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#1A6BFF] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-slate-900 font-bold text-2xl tracking-tight">
              Syncro<span className="text-[#1A6BFF]">Medic</span>
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-2">Crea tu cuenta familiar</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h1 className="text-slate-900 text-xl font-semibold mb-1">Crear cuenta</h1>
          <p className="text-slate-500 text-sm mb-6">Empieza a coordinar el equipo médico de tu hijo</p>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-slate-700 text-sm mb-1 block">Tu nombre completo</label>
              <input type="text" placeholder="Ej: María González" value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors" />
            </div>
            <div>
              <label className="text-slate-700 text-sm mb-1 block">Correo electrónico</label>
              <input type="email" placeholder="correo@ejemplo.com" value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors" />
            </div>
            <div>
              <label className="text-slate-700 text-sm mb-1 block">Contraseña</label>
              <input type="password" placeholder="Mínimo 8 caracteres" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors" />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button onClick={handleRegistro} disabled={loading}
              className="w-full bg-[#1A6BFF] hover:bg-[#1558d6] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mt-2">
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>
          </div>

          <p className="text-slate-400 text-xs text-center mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link href="/" className="text-[#1A6BFF] hover:underline">Inicia sesión</Link>
          </p>
        </div>

        <p className="text-slate-400 text-xs text-center mt-6">
          Cumplimiento NOM-004 · NOM-024 · 2026
        </p>
      </div>
    </main>
  );
}