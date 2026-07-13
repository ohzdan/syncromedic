"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ActualizarPassword() {
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [listo, setListo] = useState(false);
  const [sesionValida, setSesionValida] = useState<boolean | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // El link del correo de recuperación crea una sesión temporal (evento PASSWORD_RECOVERY).
    // Escuchamos el cambio de auth para confirmar que el link es válido antes de mostrar el formulario.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setSesionValida(true);
      }
    });

    // Si ya había una sesión de recuperación activa al cargar la página
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSesionValida(true);
      else if (sesionValida === null) {
        // Da un pequeño margen por si el evento PASSWORD_RECOVERY llega después
        setTimeout(() => {
          setSesionValida((actual) => (actual === null ? false : actual));
        }, 2000);
      }
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  async function handleActualizar() {
    setError("");

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("No se pudo actualizar la contraseña. El link puede haber expirado.");
    } else {
      setListo(true);
      setTimeout(() => router.push("/"), 2500);
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
            <span className="text-[#0f172a] font-bold text-2xl tracking-tight">
              Syncro<span className="text-[#1A6BFF]">Medic</span>
            </span>
          </div>
          <p className="text-slate-500 text-sm mt-2">
            Expediente médico compartido entre especialistas
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          {sesionValida === null && (
            <p className="text-slate-400 text-sm text-center py-6">Verificando link...</p>
          )}

          {sesionValida === false && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl mx-auto mb-4">
                ⚠️
              </div>
              <h1 className="text-slate-900 text-xl font-semibold mb-2">Link inválido o expirado</h1>
              <p className="text-slate-500 text-sm mb-4">
                Solicita un nuevo link de recuperación de contraseña.
              </p>
              <Link href="/recuperar" className="text-[#1A6BFF] text-sm hover:underline">
                Solicitar nuevo link →
              </Link>
            </div>
          )}

          {sesionValida === true && !listo && (
            <>
              <h1 className="text-slate-900 text-xl font-semibold mb-1">Nueva contraseña</h1>
              <p className="text-slate-500 text-sm mb-6">
                Define la contraseña que usarás para tu cuenta
              </p>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-slate-700 text-sm mb-1 block">Nueva contraseña</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-700 text-sm mb-1 block">Confirmar contraseña</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleActualizar()}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                  />
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  onClick={handleActualizar}
                  disabled={loading}
                  className="w-full bg-[#1A6BFF] hover:bg-[#1558d6] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
                >
                  {loading ? "Actualizando..." : "Actualizar contraseña"}
                </button>
              </div>
            </>
          )}

          {listo && (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center text-2xl mx-auto mb-4">
                ✅
              </div>
              <h1 className="text-slate-900 text-xl font-semibold mb-2">Contraseña actualizada</h1>
              <p className="text-slate-500 text-sm">
                Te llevaremos a iniciar sesión en un momento...
              </p>
            </div>
          )}
        </div>

        <p className="text-slate-400 text-xs text-center mt-6">
          Cumplimiento NOM-004 · NOM-024 · 2026
        </p>
      </div>
    </main>
  );
}