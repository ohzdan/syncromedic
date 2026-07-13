"use client";
import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

export default function RecuperarPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleRecuperar() {
    if (!email) {
      setError("Ingresa tu correo electrónico");
      return;
    }
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-password`,
    });

    // No revelamos si el correo existe o no en el sistema (evita enumeración de cuentas)
    if (error) {
      setError("Ocurrió un error. Intenta de nuevo en unos minutos.");
    } else {
      setEnviado(true);
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
          {!enviado ? (
            <>
              <h1 className="text-slate-900 text-xl font-semibold mb-1">Recuperar contraseña</h1>
              <p className="text-slate-500 text-sm mb-6">
                Ingresa tu correo y te enviaremos un link para restablecerla
              </p>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-slate-700 text-sm mb-1 block">Correo electrónico</label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRecuperar()}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                  />
                </div>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  onClick={handleRecuperar}
                  disabled={loading}
                  className="w-full bg-[#1A6BFF] hover:bg-[#1558d6] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors mt-2"
                >
                  {loading ? "Enviando..." : "Enviar link de recuperación"}
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center text-2xl mx-auto mb-4">
                📩
              </div>
              <h1 className="text-slate-900 text-xl font-semibold mb-2">Revisa tu correo</h1>
              <p className="text-slate-500 text-sm">
                Si <span className="font-medium text-slate-700">{email}</span> tiene una cuenta con nosotros, te llegará un correo con instrucciones para restablecer tu contraseña.
              </p>
            </div>
          )}

          <p className="text-slate-400 text-xs text-center mt-6">
            <Link href="/" className="text-[#1A6BFF] hover:underline">
              ← Regresar a iniciar sesión
            </Link>
          </p>
        </div>

        <p className="text-slate-400 text-xs text-center mt-6">
          Cumplimiento NOM-004 · NOM-024 · 2026
        </p>
      </div>
    </main>
  );
}