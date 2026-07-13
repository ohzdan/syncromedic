"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'

const ANTECEDENTES_FAMILIARES_LABELS: Record<string, string> = {
  diabetes: "Diabetes",
  hipertension: "Hipertensión",
  corazon: "Enfermedades del corazón",
  epilepsia: "Epilepsia o convulsiones",
  asma: "Asma",
  alergias: "Alergias alimentarias o ambientales",
  autoinmune: "Enfermedades autoinmunes (artritis, lupus, etc.)",
  cancer: "Cáncer",
  neurodesarrollo: "Trastornos del neurodesarrollo (autismo, TDAH, etc.)",
  mental: "Enfermedades mentales (depresión, esquizofrenia, etc.)",
  genetica: "Enfermedades genéticas conocidas",
};

function formatAntecedentesFamiliares(detalle: Record<string, string[]> | undefined) {
  if (!detalle) return null;
  const entradas = Object.entries(detalle).filter(
    ([, parentescos]) => parentescos && parentescos.length > 0 && !(parentescos.length === 1 && parentescos[0] === "Ninguno")
  );
  if (entradas.length === 0) return null;
  return entradas
    .map(([condId, parentescos]) => `${ANTECEDENTES_FAMILIARES_LABELS[condId] || condId} (${parentescos.join(", ")})`)
    .join("; ");
}

function Seccion({ titulo, icono, children }: { titulo: string; icono: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-4">
      <h2 className="text-slate-800 font-semibold mb-4 flex items-center gap-2">
        <span>{icono}</span> {titulo}
      </h2>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function Dato({ label, valor, sinBorde }: { label: string; valor: string | null | undefined; sinBorde?: boolean }) {
  return (
    <div className={`py-2.5 ${!sinBorde ? "border-b border-slate-100" : ""}`}>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-slate-800 text-sm font-medium mt-0.5">
        {valor || <span className="text-slate-300">Sin información</span>}
      </p>
    </div>
  );
}

export default function ResumenPaciente() {
  const [paciente, setPaciente] = useState<any>(null);
  const [rol, setRol] = useState<Rol>('familia');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const params = useParams();
  const pacienteId = params.id as string;
  const supabase = createClient();

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      setRol((userData?.role || user.user_metadata?.role || 'familia') as Rol);

      const { data } = await supabase.from("pacientes").select("*").eq("id", pacienteId).single();
      if (!data) { router.push("/dashboard"); return; }
      setPaciente(data);
      setLoading(false);
    }
    cargar();
  }, []);

  function calcularEdad(fecha: string) {
    const hoy = new Date();
    const nac = new Date(fecha);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando expediente...</p>
    </main>
  );

  const esFamilia = rol === 'familia';

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-500 hover:text-slate-900 text-sm transition-colors">
          ← Regresar
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-slate-900 text-2xl font-semibold">Expediente completo</h1>
            <p className="text-slate-500 text-sm mt-1">
              {paciente.nombre} · {calcularEdad(paciente.fecha_nacimiento)} años
            </p>
          </div>
          {esFamilia && (
            <Link
              href={`/paciente/${pacienteId}/scouting?modo=editar`}
              className="text-[#1A6BFF] text-sm font-medium hover:underline whitespace-nowrap"
            >
              ✏️ Editar
            </Link>
          )}
        </div>

        <Seccion titulo="Datos generales" icono="👤">
          <Dato label="Diagnósticos" valor={paciente.diagnosticos_principales?.join(", ")} />
          <Dato label="Alergias" valor={paciente.alergias?.join(", ")} />
          <Dato label="Tipo de sangre" valor={paciente.tipo_sangre} />
          <Dato label="Lateralidad" valor={paciente.lateralidad} sinBorde />
        </Seccion>

        <Seccion titulo="Embarazo y nacimiento" icono="🤰">
          <Dato label="Embarazo de alto riesgo" valor={paciente.embarazo_alto_riesgo} />
          <Dato
            label="Complicaciones del embarazo"
            valor={[
              paciente.complicaciones_embarazo && `Complicaciones: ${paciente.complicaciones_embarazo}`,
              paciente.diabetes_gestacional && `Diabetes gestacional: ${paciente.diabetes_gestacional}`,
            ].filter(Boolean).join(" · ") || null}
          />
          <Dato label="Semanas de gestación" valor={paciente.semanas_gestacion?.toString()} />
          <Dato label="Tipo de parto" valor={paciente.tipo_parto} />
          <Dato
            label="Complicaciones al nacer"
            valor={[
              paciente.complicaciones_nacimiento && `Complicaciones: ${paciente.complicaciones_nacimiento}`,
              paciente.peso_nacer && `Peso: ${paciente.peso_nacer}`,
            ].filter(Boolean).join(" · ") || null}
          />
          <Dato
            label="UCIN y APGAR"
            valor={[
              paciente.requirio_ucin && `UCIN: ${paciente.requirio_ucin}`,
              paciente.apgar && `APGAR: ${paciente.apgar}`,
            ].filter(Boolean).join(" · ") || null}
          />
          <Dato
            label="Tamices neonatales"
            valor={[paciente.tamiz_metabolico, paciente.tamiz_auditivo, paciente.tamiz_cardiaco].filter(Boolean).join(" · ") || null}
            sinBorde
          />
        </Seccion>

        <Seccion titulo="Desarrollo" icono="📈">
          <Dato
            label="Desarrollo motor"
            valor={
              paciente.desarrollo_motor
                ? [
                    paciente.desarrollo_motor.cabeza && `Sostuvo cabeza: ${paciente.desarrollo_motor.cabeza}`,
                    paciente.desarrollo_motor.sentado && `Se sentó: ${paciente.desarrollo_motor.sentado}`,
                    paciente.desarrollo_motor.gateo && `Gateo: ${paciente.desarrollo_motor.gateo}`,
                    paciente.desarrollo_motor.camino && `Caminó: ${paciente.desarrollo_motor.camino}`,
                    paciente.desarrollo_motor.retraso && `Retraso reportado: ${paciente.desarrollo_motor.retraso}`,
                  ].filter(Boolean).join(" · ") || null
                : null
            }
          />
          <Dato
            label="Desarrollo del lenguaje"
            valor={
              paciente.desarrollo_lenguaje
                ? [
                    paciente.desarrollo_lenguaje.primeras_palabras && `Primeras palabras: ${paciente.desarrollo_lenguaje.primeras_palabras}`,
                    paciente.desarrollo_lenguaje.retraso && `Retraso reportado: ${paciente.desarrollo_lenguaje.retraso}`,
                    paciente.desarrollo_lenguaje.regresiones && `Regresiones: ${paciente.desarrollo_lenguaje.regresiones}`,
                  ].filter(Boolean).join(" · ") || null
                : null
            }
          />
          <Dato label="Terapias actuales" valor={paciente.terapias_actuales?.join(", ")} sinBorde />
        </Seccion>

        <Seccion titulo="Antecedentes y condiciones" icono="📋">
          <Dato label="Antecedentes familiares" valor={formatAntecedentesFamiliares(paciente.antecedentes_familiares_detalle)} />
          <Dato
            label="Historial médico"
            valor={[paciente.cirugias_previas, paciente.hospitalizaciones_previas].filter(Boolean).join(" · ") || null}
          />
          <Dato label="Condiciones crónicas" valor={paciente.condiciones_cronicas?.join(", ")} sinBorde />
        </Seccion>

        <Seccion titulo="Vacunas" icono="💉">
          <Dato
            label="Vacunas registradas"
            valor={paciente.vacunas?.lista?.length ? paciente.vacunas.lista.join(", ") : null}
          />
          <Dato label="Otras vacunas" valor={paciente.vacunas_otras} sinBorde />
        </Seccion>

        <Seccion titulo="Rutinas diarias" icono="🌙">
          <Dato
            label="Sueño"
            valor={paciente.sueno_hora_dormir ? `Duerme ${paciente.sueno_hora_dormir} · Despierta ${paciente.sueno_hora_despertar}${paciente.sueno_colecho ? ` · Colecho: ${paciente.sueno_colecho}` : ""}` : null}
          />
          <Dato label="Alimentación" valor={paciente.alimentacion_notas} sinBorde />
        </Seccion>

        <Seccion titulo="Entorno familiar" icono="🏠">
          <Dato label="Con quién vive" valor={paciente.con_quien_vive} />
          <Dato label="Hermanos" valor={paciente.hermanos} />
          <Dato label="Escuela" valor={paciente.escuela_regular} sinBorde />
        </Seccion>

        <Seccion titulo="Contacto de emergencia" icono="🚨">
          <Dato label="Nombre" valor={paciente.contacto_emergencia?.nombre} />
          <Dato
            label="Teléfono y parentesco"
            valor={[paciente.contacto_emergencia?.telefono, paciente.contacto_emergencia?.parentesco].filter(Boolean).join(" · ") || null}
          />
          <Dato label="Hospital de preferencia" valor={paciente.hospital_preferencia} />
          <Dato label="Médico de cabecera" valor={paciente.medico_cabecera} />
          <Dato
            label="Seguro médico"
            valor={paciente.seguro_medico === "Sí" ? `Sí${paciente.aseguradora ? ` — ${paciente.aseguradora}` : ""}` : paciente.seguro_medico}
            sinBorde
          />
        </Seccion>
      </div>
    </main>
  );
}