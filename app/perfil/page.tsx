"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'

export default function Perfil() {
  const [user, setUser] = useState<any>(null);
  const [rol, setRol] = useState<Rol>('familia');
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUser(user);

      const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
      const rolActual: Rol = userData?.role || user.user_metadata?.role || 'familia';
      setRol(rolActual);

      if (rolActual === 'familia') {
        const { data } = await supabase
          .from('pacientes')
          .select('id, nombre, apodo')
          .eq('familia_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        setPacientes(data || []);
      }

      setCargando(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (cargando || !user) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  const esFamilia = rol === 'familia';
  const nombreUsuario = user.user_metadata?.full_name || user.user_metadata?.nombre || user.email;
  const iniciales = (nombreUsuario || "").split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-white pb-10">
      <div className="max-w-lg mx-auto px-4 pt-6">

        <div className="flex items-center gap-3 mb-6">
          <div className="w-13 h-13 rounded-full bg-blue-50 flex items-center justify-center text-[#1A6BFF] font-semibold text-lg flex-shrink-0" style={{ width: 52, height: 52 }}>
            {iniciales || "👤"}
          </div>
          <div>
            <p className="text-slate-900 text-base font-semibold">{nombreUsuario}</p>
            <p className="text-slate-400 text-xs mt-0.5">{user.email}</p>
          </div>
        </div>

        {esFamilia && (
          <div className="mb-6">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-1">Registros de bitácora</p>
            <p className="text-slate-300 text-[11px] mb-2.5">Qué se registra para cada peque</p>
            <div className="bg-slate-50 rounded-2xl overflow-hidden">
              {pacientes.length === 0 ? (
                <p className="text-slate-300 text-sm p-4">Aún no tienes pacientes registrados</p>
              ) : (
                pacientes.map(p => (
                  <Link
                    key={p.id}
                    href={`/paciente/${p.id}/bitacora/ajustes`}
                    className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 last:border-b-0 no-underline"
                  >
                    <span className="text-sm text-slate-800">Bitácora de {p.apodo || p.nombre}</span>
                    <span className="text-slate-300 text-sm">›</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          <p className="text-slate-400 text-xs uppercase tracking-wide mb-2.5">General</p>
          <div className="bg-slate-50 rounded-2xl overflow-hidden">
            {/* Notificaciones: pantalla pendiente de construir */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 opacity-50">
              <span className="text-sm text-slate-800 flex items-center gap-2.5">🔔 Notificaciones</span>
              <span className="text-slate-300 text-[10px]">Próximamente</span>
            </div>
            {/* Seguridad y contraseña: pantalla pendiente de construir */}
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 opacity-50">
              <span className="text-sm text-slate-800 flex items-center gap-2.5">🔒 Seguridad y contraseña</span>
              <span className="text-slate-300 text-[10px]">Próximamente</span>
            </div>
            {esFamilia && (
              <Link href="/suscripcion" className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 no-underline">
                <span className="text-sm text-slate-800 flex items-center gap-2.5">💳 Suscripción y pago</span>
                <span className="text-slate-300 text-sm">›</span>
              </Link>
            )}
            {/* Ayuda y soporte: pantalla pendiente de construir */}
            <div className="flex items-center justify-between px-4 py-3.5 opacity-50">
              <span className="text-sm text-slate-800 flex items-center gap-2.5">❓ Ayuda y soporte</span>
              <span className="text-slate-300 text-[10px]">Próximamente</span>
            </div>
          </div>
        </div>

        <button onClick={cerrarSesion} className="w-full text-center text-red-500 text-sm font-medium py-2">
          Cerrar sesión
        </button>
      </div>
    </main>
  );
}