"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Consentimiento() {
  const [aceptado, setAceptado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function cargarUsuario() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUsuario(user);
    }
    cargarUsuario();
  }, []);

  async function handleAceptar() {
    if (!aceptado || !usuario) return;
    setLoading(true);

    await supabase.from("users").update({
      consentimiento_aceptado: true,
      consentimiento_fecha: new Date().toISOString(),
    }).eq("id", usuario.id);

    router.push("/dashboard");
    setLoading(false);
  }

  const fecha = new Date().toLocaleDateString("es-MX", {
    day: "numeric", month: "long", year: "numeric"
  });

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl">

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#1A6BFF] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            <span className="text-slate-900 font-bold text-2xl tracking-tight">
              Syncro<span className="text-[#1A6BFF]">Medic</span>
            </span>
          </div>
          <h1 className="text-slate-900 text-2xl font-semibold mb-2">Aviso de privacidad y consentimiento</h1>
          <p className="text-slate-500 text-sm">Lee con atención antes de continuar</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden mb-6">

          <div className="bg-slate-50 border-b border-slate-200 px-6 py-4">
            <p className="text-slate-700 text-sm font-semibold">CARTA DE CONSENTIMIENTO INFORMADO PARA TRATAMIENTO DE DATOS PERSONALES</p>
            <p className="text-slate-500 text-xs mt-1">SyncroMedic · Ciudad de México · {fecha}</p>
          </div>

          <div className="px-6 py-6 flex flex-col gap-5 text-sm text-slate-600 leading-relaxed max-h-96 overflow-y-auto">

            <div>
              <p className="font-semibold text-slate-800 mb-1">1. Responsable del tratamiento de datos</p>
              <p>SyncroMedic es una plataforma digital de expediente clínico compartido operada por su titular. Los datos que registres serán almacenados de forma segura en servidores con cifrado en tránsito y en reposo, en cumplimiento con la NOM-024-SSA3-2012.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">2. Datos que se recaban</p>
              <p>Se recaban datos de identificación, contacto y datos clínicos del paciente, incluyendo diagnósticos, medicamentos, notas médicas, documentos y antecedentes de salud.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">3. Finalidad del tratamiento</p>
              <p>Los datos se utilizan exclusivamente para integrar y compartir el expediente clínico del paciente con los especialistas que la familia autorice expresamente mediante invitación. No se compartirán con terceros sin tu consentimiento.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">4. Control de acceso</p>
              <p>La familia es la titular del expediente. Solo los especialistas que tú invites podrán acceder a la información. Puedes revocar el acceso en cualquier momento desde el panel de equipo médico.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">5. Derechos ARCO</p>
              <p>Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al tratamiento de tus datos personales en cualquier momento, escribiendo a <span className="text-[#1A6BFF]">hola@syncromedic.com.mx</span>.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">6. Conservación de datos</p>
              <p>Los datos clínicos se conservarán por un mínimo de 5 años a partir del último acto médico registrado, en cumplimiento con el numeral 5.4 de la NOM-004-SSA3-2012.</p>
            </div>

            <div>
              <p className="font-semibold text-slate-800 mb-1">7. Menores de edad</p>
              <p>Al aceptar este consentimiento, declaras ser padre, madre o tutor legal del paciente registrado, y estar facultado para autorizar el tratamiento de sus datos de salud.</p>
            </div>

          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
          <button
            onClick={() => setAceptado(!aceptado)}
            className="flex items-start gap-3 w-full text-left"
          >
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${aceptado ? "bg-[#1A6BFF] border-[#1A6BFF]" : "border-slate-300"}`}>
              {aceptado && <span className="text-white text-xs font-bold">✓</span>}
            </div>
            <p className="text-slate-700 text-sm leading-relaxed">
              He leído y acepto el aviso de privacidad y el tratamiento de los datos personales y clínicos del paciente conforme a lo descrito. Declaro ser padre, madre o tutor legal del paciente.
            </p>
          </button>
        </div>

        <button
          onClick={handleAceptar}
          disabled={!aceptado || loading}
          className="w-full bg-[#1A6BFF] hover:bg-[#1558d6] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl transition-colors"
        >
          {loading ? "Guardando..." : "Acepto y continuar →"}
        </button>

        <p className="text-slate-400 text-xs text-center mt-4">
          Cumplimiento NOM-004-SSA3-2012 · NOM-024-SSA3-2012 · Ley Federal de Protección de Datos Personales
        </p>

      </div>
    </main>
  );
}