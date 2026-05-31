"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function cargarDatos() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUser(user);

      const { data } = await supabase
        .from("pacientes")
        .select("*")
        .eq("familia_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setPacientes(data || []);
      setLoading(false);
    }
    cargarDatos();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  function calcularEdad(fechaNacimiento: string) {
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad;
  }

  if (!user) return null;

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
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">
            {user.user_metadata?.full_name || user.email}
          </span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm transition-colors">
            Salir
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white text-2xl font-semibold">
              Hola, {user.user_metadata?.full_name?.split(" ")[0] || "familia"} 👋
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {pacientes.length === 0
                ? "Aún no tienes expedientes registrados"
                : `${pacientes.length} expediente${pacientes.length > 1 ? "s" : ""} activo${pacientes.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <Link
            href="/paciente/nuevo"
            className="bg-[#00C97A] hover:bg-[#00b36c] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Nuevo paciente
          </Link>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Cargando...</div>
        ) : pacientes.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-4xl mb-4">👶</p>
            <h2 className="text-white font-semibold mb-2">Registra tu primer paciente</h2>
            <p className="text-slate-400 text-sm mb-6">
              Crea el expediente de tu hijo para empezar a coordinar su equipo médico
            </p>
            <Link
              href="/paciente/nuevo"
              className="bg-[#00C97A] hover:bg-[#00b36c] text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-block"
            >
              Crear expediente
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {pacientes.map((paciente) => (
              <Link
                key={paciente.id}
                href={`/paciente/${paciente.id}`}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-[#00C97A]/50 transition-colors"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-[#00C97A]/10 flex items-center justify-center text-xl">
                    👤
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">{paciente.nombre}</h2>
                    <p className="text-slate-400 text-sm">
                      {calcularEdad(paciente.fecha_nacimiento)} años · {paciente.sexo || "—"}
                    </p>
                  </div>
                </div>
                {paciente.diagnosticos_principales?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {paciente.diagnosticos_principales.map((dx: string, i: number) => (
                      <span key={i} className="text-xs bg-[#1A6BFF]/20 text-[#60a5fa] px-2 py-1 rounded-full">
                        {dx}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}