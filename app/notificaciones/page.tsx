"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Notificacion = {
  id: string;
  tipo: string;
  referencia_id: string | null;
  leido: boolean;
  created_at: string;
  paciente_id?: string | null;
  paciente_nombre?: string | null;
};

const LABELS_TIPO: Record<string, { titulo: string; icono: string }> = {
  confirmar_publicacion: { titulo: "Te etiquetaron en una consulta", icono: "🩺" },
};

function formatFechaRelativa(fecha: string) {
  const diffMs = Date.now() - new Date(fecha).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Justo ahora";
  if (min < 60) return `Hace ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Hace ${dias} día${dias === 1 ? "" : "s"}`;
}

export default function Notificaciones() {
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: notifs } = await supabase
      .from("notificaciones")
      .select("id, tipo, referencia_id, leido, created_at")
      .eq("usuario_id", user.id)
      .order("created_at", { ascending: false });

    const lista = (notifs || []) as Notificacion[];

    // Para notificaciones de publicación, traemos el paciente al que pertenecen
    const idsPublicaciones = lista.filter(n => n.tipo === "confirmar_publicacion" && n.referencia_id).map(n => n.referencia_id as string);
    if (idsPublicaciones.length > 0) {
      const { data: pubs } = await supabase
        .from("publicaciones")
        .select("id, paciente_id, pacientes(nombre, apodo)")
        .in("id", idsPublicaciones);

      const mapaPacientes: Record<string, { id: string; nombre: string }> = {};
      for (const p of (pubs || []) as any[]) {
        mapaPacientes[p.id] = { id: p.paciente_id, nombre: p.pacientes?.apodo || p.pacientes?.nombre || "un paciente" };
      }
      for (const n of lista) {
        if (n.referencia_id && mapaPacientes[n.referencia_id]) {
          n.paciente_id = mapaPacientes[n.referencia_id].id;
          n.paciente_nombre = mapaPacientes[n.referencia_id].nombre;
        }
      }
    }

    setNotificaciones(lista);
    setCargando(false);

    const idsNoLeidas = lista.filter(n => !n.leido).map(n => n.id);
    if (idsNoLeidas.length > 0) {
      await supabase.from("notificaciones").update({ leido: true }).in("id", idsNoLeidas);
    }
  }

  function hrefDeNotificacion(n: Notificacion) {
    if (n.tipo === "confirmar_publicacion" && n.paciente_id) return `/paciente/${n.paciente_id}/timeline`;
    return "/dashboard";
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-10">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <button onClick={() => router.back()} className="text-slate-400 text-sm mb-3">← Regresar</button>
        <h1 className="text-slate-900 text-xl font-semibold mb-6">Notificaciones</h1>

        {notificaciones.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">🔔</p>
            <p className="text-slate-400 text-sm">No tienes notificaciones todavía</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {notificaciones.map(n => {
              const info = LABELS_TIPO[n.tipo] || { titulo: n.tipo, icono: "🔔" };
              return (
                <Link
                  key={n.id}
                  href={hrefDeNotificacion(n)}
                  className={`rounded-2xl p-4 flex items-start gap-3 no-underline ${n.leido ? "bg-slate-50" : "bg-blue-50"}`}
                >
                  <span className="text-lg flex-shrink-0">{info.icono}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.leido ? "text-slate-700" : "text-[#0C447C] font-medium"}`}>
                      {info.titulo}{n.paciente_nombre ? ` — ${n.paciente_nombre}` : ''}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">{formatFechaRelativa(n.created_at)}</p>
                  </div>
                  {!n.leido && <span className="w-2 h-2 rounded-full bg-[#1A6BFF] flex-shrink-0 mt-1.5" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}