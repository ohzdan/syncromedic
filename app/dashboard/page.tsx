"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
      } else {
        setUser(user);
      }
    }
    getUser();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (!user) return null;

  return (
    <main className="min-h-screen bg-[#0a1628]">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-white font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">
            {user.user_metadata?.full_name || user.email}
          </span>
          <button
            onClick={handleLogout}
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            Salir
          </button>
        </div>
      </nav>

      {/* Contenido */}
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-white text-2xl font-semibold">
            Bienvenido, {user.user_metadata?.full_name?.split(" ")[0] || "familia"} 👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Aquí administras el expediente de tu hijo
          </p>
        </div>

        {/* Cards de acceso rápido */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00C97A]/50 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[#00C97A]/10 flex items-center justify-center mb-4">
              <span className="text-[#00C97A] text-xl">👤</span>
            </div>
            <h2 className="text-white font-semibold mb-1">Perfil del paciente</h2>
            <p className="text-slate-400 text-sm">Datos generales, diagnósticos y alergias</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00C97A]/50 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-[#1A6BFF]/10 flex items-center justify-center mb-4">
              <span className="text-[#1A6BFF] text-xl">🩺</span>
            </div>
            <h2 className="text-white font-semibold mb-1">Equipo médico</h2>
            <p className="text-slate-400 text-sm">Doctores, terapeutas y escuela vinculados</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00C97A]/50 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center mb-4">
              <span className="text-purple-400 text-xl">📋</span>
            </div>
            <h2 className="text-white font-semibold mb-1">Notas clínicas</h2>
            <p className="text-slate-400 text-sm">Consultas, sesiones y reportes del equipo</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00C97A]/50 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-4">
              <span className="text-orange-400 text-xl">💊</span>
            </div>
            <h2 className="text-white font-semibold mb-1">Medicamentos</h2>
            <p className="text-slate-400 text-sm">Medicamentos activos y quién los indicó</p>
          </div>
        </div>
      </div>
    </main>
  );
}