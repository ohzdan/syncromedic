"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Familia = {
  id: string;
  full_name: string | null;
  email: string;
  pacientes: { id: string; nombre: string; fecha_nacimiento: string }[];
  suscripcion: { id: string; estado: string; fecha_vencimiento: string } | null;
};

function calcularEdad(fecha: string) {
  const hoy = new Date();
  const nac = new Date(fecha);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
}

const ESTADOS_BADGE: Record<string, { label: string; color: string }> = {
  activa: { label: "Activa", color: "#00C97A" },
  trial: { label: "Periodo beta", color: "#1A6BFF" },
  vencida: { label: "Vencida", color: "#ef4444" },
  cancelada: { label: "Cancelada", color: "#94a3b8" },
  pausada: { label: "Pausada", color: "#f59e0b" },
};

export default function AdminPanel() {
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: userData } = await supabase.from("users").select("role").eq("id", user.id).single();
    const rol = userData?.role || user.user_metadata?.role;

    if (rol !== "admin") {
      setAutorizado(false);
      setCargando(false);
      return;
    }
    setAutorizado(true);

    const { data: usuariosFamilia } = await supabase
      .from("users")
      .select("id, full_name, email")
      .eq("role", "familia");

    const lista: Familia[] = [];
    for (const u of usuariosFamilia || []) {
      const { data: pacientesData } = await supabase
        .from("pacientes")
        .select("id, nombre, fecha_nacimiento")
        .eq("familia_id", u.id)
        .is("deleted_at", null);

      const { data: suscripcionesData } = await supabase
        .from("suscripciones")
        .select("id, estado, fecha_vencimiento")
        .eq("familia_id", u.id)
        .order("created_at", { ascending: false })
        .limit(1);

      lista.push({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        pacientes: pacientesData || [],
        suscripcion: suscripcionesData?.[0] || null,
      });
    }

    setFamilias(lista);
    setCargando(false);
  }

  async function extenderSuscripcion(suscripcionId: string, dias: number) {
    const { data: sus } = await supabase.from("suscripciones").select("fecha_vencimiento").eq("id", suscripcionId).single();
    if (!sus) return;
    const nuevaFecha = new Date(sus.fecha_vencimiento);
    nuevaFecha.setDate(nuevaFecha.getDate() + dias);
    await supabase.from("suscripciones").update({ fecha_vencimiento: nuevaFecha.toISOString(), estado: "activa" }).eq("id", suscripcionId);
    cargar();
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  if (autorizado === false) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-3xl mb-3">🔒</p>
          <p className="text-slate-600 text-sm">No tienes permiso para ver esta pantalla.</p>
        </div>
      </main>
    );
  }

  const filtradas = familias.filter(f =>
    !busqueda ||
    f.full_name?.toLowerCase().includes(busqueda.toLowerCase()) ||
    f.email.toLowerCase().includes(busqueda.toLowerCase()) ||
    f.pacientes.some(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  );

  return (
    <main className="min-h-screen bg-white pb-10">
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <p className="text-[#00C97A] text-[11px] font-semibold tracking-wide uppercase mb-0.5">Admin</p>
        <h1 className="text-slate-900 text-xl font-semibold mb-1">Soporte</h1>
        <p className="text-slate-400 text-xs mb-5">
          Vista de soporte — sin acceso a bitácoras, notas ni información clínica de ningún paciente.
        </p>

        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, correo o paciente..."
          className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-sm mb-5 focus:outline-none focus:border-[#1A6BFF]"
        />

        {filtradas.length === 0 ? (
          <p className="text-slate-300 text-sm text-center py-10">Sin resultados</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filtradas.map(f => {
              const badge = f.suscripcion ? (ESTADOS_BADGE[f.suscripcion.estado] || { label: f.suscripcion.estado, color: "#94a3b8" }) : null;
              return (
                <div key={f.id} className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-slate-900 text-sm font-semibold">{f.full_name || "Sin nombre"}</p>
                      <p className="text-slate-400 text-xs">{f.email}</p>
                    </div>
                    {badge && (
                      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: badge.color + "20", color: badge.color }}>
                        {badge.label}
                      </span>
                    )}
                  </div>

                  {f.pacientes.length > 0 && (
                    <p className="text-slate-500 text-xs mb-2">
                      {f.pacientes.map(p => `${p.nombre} (${calcularEdad(p.fecha_nacimiento)}a)`).join(" · ")}
                    </p>
                  )}

                  {f.suscripcion && (
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <p className="text-slate-400 text-[11px]">Vence: {formatFecha(f.suscripcion.fecha_vencimiento)}</p>
                      <div className="flex gap-2">
                        <button onClick={() => extenderSuscripcion(f.suscripcion!.id, 7)} className="text-[#1A6BFF] text-[11px] font-medium">+7 días</button>
                        <button onClick={() => extenderSuscripcion(f.suscripcion!.id, 30)} className="text-[#1A6BFF] text-[11px] font-medium">+30 días</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}