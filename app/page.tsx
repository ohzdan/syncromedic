"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Correo o contraseña incorrectos");
    } else {
      router.push("/dashboard");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f1f3d] via-[#0d2a3f] to-[#0a1628]">
      <div className="w-full max-w-md px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-[#00C97A] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">
              Syncro<span className="text-[#00C97A]">Medic</span>
            </span>
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Expediente médico compartido entre especialistas
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-8">
          <h1 className="text-white text-xl font-semibold mb-1">Bienvenido</h1>
          <p className="text-slate-400 text-sm mb-6">Ingresa a tu cuenta para continuar</p>

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-slate-300 text-sm mb-1 block">Correo electrónico</label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-[#00C97A] transition-colors"
              />
            </div>
            <div>
              <label className="text-slate-300 text-sm mb-1 block">Contraseña</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 text-sm focus:outline-none focus:border-[#00C97A] transition-colors"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-[#00C97A] hover:bg-[#00b36c] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </div>

          <p className="text-slate-500 text-xs text-center mt-6">
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="text-[#00C97A] hover:underline">
              Regístrate aquí
            </Link>
          </p>
        </div>

        <p className="text-slate-600 text-xs text-center mt-6">
          Cumplimiento NOM-004 · NOM-024 · 2026
        </p>
      </div>
    </main>
  );
}