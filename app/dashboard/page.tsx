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
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#1A6BFF] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#1A6BFF]">Medic</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm">
            {user.user_metadata?.full_name || user.email}
          </span>
          <button onClick={handleLogout} className="text-slate-400 hover:text-slate-700 text-sm transition-colors">
            Salir
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-slate-900 text-2xl font-semibold">
              Hola, {user.user_metadata?.full_name?.split(" ")[0] || "familia"} 👋
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {pacientes.length === 0
                ? "Aún no tienes expedientes registrados"
                : `${pacientes.length} expediente${pacientes.length > 1 ? "s" : ""} activo${pacientes.length > 1 ? "s" : ""}`}
            </p>
          </div>
          <Link
            href="/paciente/nuevo"
            className="bg-[#1A6BFF] hover:bg-[#1558d6] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            + Nuevo paciente
          </Link>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Cargando...</div>
        ) : pacientes.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
            <p className="text-4xl mb-4">👶</p>
            <h2 className="text-slate-900 font-semibold mb-2">Registra tu primer paciente</h2>
            <p className="text-slate-500 text-sm mb-6">
              Crea el expediente de tu hijo para empezar a coordinar su equipo médico
            </p>
            <Link
              href="/paciente/nuevo"
              className="bg-[#1A6BFF] hover:bg-[#1558d6] text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors inline-block"
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
                className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-xl">
                    👤
                  </div>
                  <div>
                    <h2 className="text-slate-900 font-semibold">{paciente.nombre}</h2>
                    <p className="text-slate-500 text-sm">
                      {calcularEdad(paciente.fecha_nacimiento)} años · {paciente.sexo || "—"}
                    </p>
                  </div>
                </div>
                {paciente.diagnosticos_principales?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {paciente.diagnosticos_principales.map((dx: string, i: number) => (
                      <span key={i} className="text-xs bg-blue-50 text-[#1A6BFF] px-2 py-1 rounded-full border border-blue-100">
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