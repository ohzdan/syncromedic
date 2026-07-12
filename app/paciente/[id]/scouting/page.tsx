"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";

const VACUNAS_MEXICO = [
  "BCG (tuberculosis)",
  "Hepatitis B",
  "Pentavalente (DPT + HiB + HepB)",
  "Rotavirus",
  "Neumocócica conjugada",
  "SRP (Sarampión, Rubéola, Parotiditis)",
  "DPT (refuerzo preescolar)",
  "Influenza (anual)",
  "VPH (Virus del Papiloma Humano)",
  "Varicela",
  "Hepatitis A",
  "Meningocócica",
];

const ANTECEDENTES_FAMILIARES = [
  { id: "diabetes", label: "Diabetes" },
  { id: "hipertension", label: "Hipertensión" },
  { id: "corazon", label: "Enfermedades del corazón" },
  { id: "epilepsia", label: "Epilepsia o convulsiones" },
  { id: "asma", label: "Asma" },
  { id: "alergias", label: "Alergias alimentarias o ambientales" },
  { id: "autoinmune", label: "Enfermedades autoinmunes (artritis, lupus, etc.)" },
  { id: "cancer", label: "Cáncer" },
  { id: "neurodesarrollo", label: "Trastornos del neurodesarrollo (autismo, TDAH, etc.)" },
  { id: "mental", label: "Enfermedades mentales (depresión, esquizofrenia, etc.)" },
  { id: "genetica", label: "Enfermedades genéticas conocidas" },
];

const PARENTESCOS = ["Papá", "Mamá", "Hermano/a", "Abuelo/a paterno/a", "Abuelo/a materno/a", "Ninguno", "No sé"];

const CONDICIONES_CRONICAS = [
  "Asma o sibilancias",
  "Rinitis alérgica",
  "Dermatitis atópica o eccemas",
  "Ronquido nocturno frecuente",
  "Apneas del sueño",
  "Infecciones frecuentes de oído u otitis",
  "Neumonías o bronquitis previas",
  "Reflujo gastroesofágico o vómitos frecuentes",
  "Dolor abdominal recurrente",
  "Estreñimiento crónico",
  "Convulsiones o episodios de pérdida de alerta",
  "Soplos cardíacos diagnosticados",
  "Infecciones urinarias frecuentes",
  "Enfermedades autoinmunes",
];

const TERAPIAS = [
  "Terapia de lenguaje",
  "Terapia física",
  "Terapia ocupacional",
  "Terapia de neurodesarrollo",
  "Psicología",
  "Musicoterapia",
  "ABA (Análisis de conducta aplicado)",
  "Otra",
];

type Pantalla =
  | { tipo: "intro" }
  | { tipo: "paso"; id: string }
  | { tipo: "intermedia"; mensaje: string; submensaje: string }
  | { tipo: "resumen" };

const FLUJO: Pantalla[] = [
  { tipo: "intro" },
  { tipo: "paso", id: "diagnosticos" },
  { tipo: "paso", id: "alergias" },
  { tipo: "paso", id: "tipo_sangre" },
  { tipo: "paso", id: "lateralidad" },
  { tipo: "intermedia", mensaje: "Vamos bien 👍", submensaje: "Ahora unas preguntas sobre el nacimiento. Ten a la mano cualquier documento del hospital si lo necesitas, pero no es indispensable." },
  { tipo: "paso", id: "embarazo_alto_riesgo" },
  { tipo: "paso", id: "complicaciones_embarazo" },
  { tipo: "paso", id: "parto" },
  { tipo: "paso", id: "nacimiento" },
  { tipo: "paso", id: "ucin_apgar" },
  { tipo: "paso", id: "tamices" },
  { tipo: "intermedia", mensaje: "Muy bien 💪", submensaje: "Ahora algunas preguntas sobre el desarrollo de tu hijo/a. Responde lo que recuerdes — no hay respuestas incorrectas." },
  { tipo: "paso", id: "desarrollo_motor" },
  { tipo: "paso", id: "desarrollo_lenguaje" },
  { tipo: "paso", id: "terapias" },
  { tipo: "intermedia", mensaje: "Ya casi 🏁", submensaje: "Ahora antecedentes familiares y un breve historial médico. Solo lo que sepas." },
  { tipo: "paso", id: "antecedentes_familiares" },
  { tipo: "paso", id: "historial_medico" },
  { tipo: "paso", id: "condiciones_cronicas" },
  { tipo: "intermedia", mensaje: "Una sección más 📋", submensaje: "Ten tu cartilla de vacunación a la mano para la siguiente parte. Si no la tienes ahorita, puedes omitir y completarla después." },
  { tipo: "paso", id: "vacunas" },
  { tipo: "paso", id: "sueno" },
  { tipo: "paso", id: "alimentacion" },
  { tipo: "paso", id: "entorno" },
  { tipo: "paso", id: "emergencia" },
  { tipo: "resumen" },
];

export default function ScoutingPage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

const searchParams = useSearchParams();
  const modoEditar = searchParams.get("modo") === "editar";
  const [indice, setIndice] = useState(0);
  const [paciente, setPaciente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectVal, setSelectVal] = useState("");
  const [texto1, setTexto1] = useState("");
  const [bool1, setBool1] = useState("");
  const [bool2, setBool2] = useState("");
  const [vacunasSeleccionadas, setVacunasSeleccionadas] = useState<string[]>([]);
  const [vacunasOtras, setVacunasOtras] = useState("");
  const [antFamiliares, setAntFamiliares] = useState<Record<string, string[]>>({});
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTel, setContactoTel] = useState("");
  const [contactoParentesco, setContactoParentesco] = useState("");
  const [hospitalPref, setHospitalPref] = useState("");
  const [medicoCabecera, setMedicoCabecera] = useState("");
  const [seguroMedico, setSeguroMedico] = useState("");
  const [aseguradora, setAseguradora] = useState("");
  const [condicionesSeleccionadas, setCondicionesSeleccionadas] = useState<string[]>([]);
  const [terapiasSeleccionadas, setTerapiasSeleccionadas] = useState<string[]>([]);

  // Desarrollo motor
  const [edadCabeza, setEdadCabeza] = useState("");
  const [edadSentado, setEdadSentado] = useState("");
  const [edadGateo, setEdadGateo] = useState("");
  const [edadCamino, setEdadCamino] = useState("");
  const [retrasoMotor, setRetrasoMotor] = useState("");

  // Desarrollo lenguaje
  const [edadPalabras, setEdadPalabras] = useState("");
  const [retrasoLenguaje, setRetrasoLenguaje] = useState("");
  const [regresiones, setRegresiones] = useState("");

  // Historial
  const [cirugias, setCirugias] = useState("");
  const [hospitalizaciones, setHospitalizaciones] = useState("");

  // Tamices
  const [tamizMetabolico, setTamizMetabolico] = useState("");
  const [tamizAuditivo, setTamizAuditivo] = useState("");
  const [tamizCardiaco, setTamizCardiaco] = useState("");

  // Nuevos campos
  const [lateralidad, setLateralidad] = useState("");
  const [hermanos, setHermanos] = useState("");
  const [alimentacionNotas, setAlimentacionNotas] = useState("");
  const [suenoHoraDormir, setSuenoHoraDormir] = useState("");
  const [suenoHoraDespertar, setSuenoHoraDespertar] = useState("");
  const [suenoColecho, setSuenoColecho] = useState("");
  const [escuelaRegular, setEscuelaRegular] = useState("");
  const [conQuienVive, setConQuienVive] = useState("");

  useEffect(() => { cargarPaciente(); }, []);

  async function cargarPaciente() {
    const { data } = await supabase.from("pacientes").select("*").eq("id", pacienteId).single();
    if (data) {
      setPaciente(data);
     const idx = modoEditar
        ? FLUJO.length - 1
        : Math.min(data.scouting_paso || 0, FLUJO.length - 1);
      setIndice(idx);
      cargarEstadoGlobal(data);
    }
    setLoading(false);
  }

  function cargarEstadoGlobal(data: any) {
    setVacunasSeleccionadas(data.vacunas?.lista || []);
    setVacunasOtras(data.vacunas_otras || "");
    setAntFamiliares(data.antecedentes_familiares_detalle || {});
    setCondicionesSeleccionadas(data.condiciones_cronicas || []);
    setTerapiasSeleccionadas(data.terapias_actuales || []);
    const c = data.contacto_emergencia || {};
    setContactoNombre(c.nombre || "");
    setContactoTel(c.telefono || "");
    setContactoParentesco(c.parentesco || "");
    setHospitalPref(data.hospital_preferencia || "");
    setMedicoCabecera(data.medico_cabecera || "");
    setSeguroMedico(data.seguro_medico || "");
    setAseguradora(data.aseguradora || "");
    const dm = data.desarrollo_motor || {};
    setEdadCabeza(dm.cabeza || ""); setEdadSentado(dm.sentado || ""); setEdadGateo(dm.gateo || ""); setEdadCamino(dm.camino || ""); setRetrasoMotor(dm.retraso || "");
    const dl = data.desarrollo_lenguaje || {};
    setEdadPalabras(dl.primeras_palabras || ""); setRetrasoLenguaje(dl.retraso || ""); setRegresiones(dl.regresiones || "");
    setCirugias(data.cirugias_previas || "");
    setHospitalizaciones(data.hospitalizaciones_previas || "");
    setTamizMetabolico(data.tamiz_metabolico || "");
    setTamizAuditivo(data.tamiz_auditivo || "");
    setTamizCardiaco(data.tamiz_cardiaco || "");
    setLateralidad(data.lateralidad || "");
    setHermanos(data.hermanos || "");
    setAlimentacionNotas(data.alimentacion_notas || "");
    setSuenoHoraDormir(data.sueno_hora_dormir || "");
    setSuenoHoraDespertar(data.sueno_hora_despertar || "");
    setSuenoColecho(data.sueno_colecho || "");
    setEscuelaRegular(data.escuela_regular || "");
    setConQuienVive(data.con_quien_vive || "");
  }

  function limpiarCampos() {
    setTagInput(""); setSelectVal(""); setTexto1(""); setBool1(""); setBool2("");
  }

  function cargarPaso(id: string, data: any) {
    limpiarCampos();
    if (id === "diagnosticos") setTags(data.diagnosticos_principales || []);
    if (id === "alergias") setTags(data.alergias || []);
    if (id === "tipo_sangre") setSelectVal(data.tipo_sangre || "");
    if (id === "embarazo_alto_riesgo") setBool1(data.embarazo_alto_riesgo || "");
    if (id === "complicaciones_embarazo") { setBool1(data.complicaciones_embarazo || ""); setBool2(data.diabetes_gestacional || ""); }
    if (id === "parto") { setSelectVal(data.semanas_gestacion?.toString() || ""); setBool1(data.tipo_parto || ""); }
    if (id === "nacimiento") { setBool1(data.complicaciones_nacimiento || ""); setTexto1(data.peso_nacer || ""); }
    if (id === "ucin_apgar") { setBool1(data.requirio_ucin || ""); setTexto1(data.apgar || ""); }
    if (id === "tamices") { setTamizMetabolico(data.tamiz_metabolico || ""); setTamizAuditivo(data.tamiz_auditivo || ""); setTamizCardiaco(data.tamiz_cardiaco || ""); }
  }

  function toggleAntFamiliar(condId: string, parentesco: string) {
    setAntFamiliares(prev => {
      const actual = prev[condId] || [];
      const esNinguno = parentesco === "Ninguno" || parentesco === "No sé";
      const clickandoExclusivo = esNinguno;

      if (clickandoExclusivo) {
        // Si ya está seleccionado, deseleccionar
        if (actual.includes(parentesco)) return { ...prev, [condId]: [] };
        // Si no, seleccionar solo este y quitar todos los demás
        return { ...prev, [condId]: [parentesco] };
      } else {
        // Si selecciona un parentesco normal, quitar Ninguno y No sé
        const sinExclusivos = actual.filter((x: string) => x !== "Ninguno" && x !== "No sé");
        const yaEsta = sinExclusivos.includes(parentesco);
        return { ...prev, [condId]: yaEsta ? sinExclusivos.filter((x: string) => x !== parentesco) : [...sinExclusivos, parentesco] };
      }
    });
  }

  async function guardarPaso(omitir = false) {
    setGuardando(true);
    const pantalla = FLUJO[indice];
    if (pantalla.tipo !== "paso") { avanzar(); setGuardando(false); return; }

    const id = pantalla.id;
    let update: any = { updated_at: new Date().toISOString() };
    if (!modoEditar) update.scouting_paso = indice + 1;

    if (!omitir) {
      if (id === "diagnosticos") update.diagnosticos_principales = tags;
      if (id === "alergias") update.alergias = tags;
      if (id === "tipo_sangre") update.tipo_sangre = selectVal || null;
      if (id === "lateralidad") update.lateralidad = lateralidad || null;
      if (id === "embarazo_alto_riesgo") update.embarazo_alto_riesgo = bool1 || null;
      if (id === "complicaciones_embarazo") { update.complicaciones_embarazo = bool1 || null; update.diabetes_gestacional = bool2 || null; }
      if (id === "parto") { update.semanas_gestacion = selectVal ? parseInt(selectVal) : null; update.tipo_parto = bool1 || null; }
      if (id === "nacimiento") { update.complicaciones_nacimiento = bool1 || null; update.peso_nacer = texto1 || null; }
      if (id === "ucin_apgar") { update.requirio_ucin = bool1 || null; update.apgar = texto1 || null; }
      if (id === "tamices") { update.tamiz_metabolico = tamizMetabolico || null; update.tamiz_auditivo = tamizAuditivo || null; update.tamiz_cardiaco = tamizCardiaco || null; }
      if (id === "desarrollo_motor") update.desarrollo_motor = { cabeza: edadCabeza, sentado: edadSentado, gateo: edadGateo, camino: edadCamino, retraso: retrasoMotor };
      if (id === "desarrollo_lenguaje") update.desarrollo_lenguaje = { primeras_palabras: edadPalabras, retraso: retrasoLenguaje, regresiones };
      if (id === "terapias") update.terapias_actuales = terapiasSeleccionadas;
      if (id === "antecedentes_familiares") update.antecedentes_familiares_detalle = antFamiliares;
      if (id === "historial_medico") { update.cirugias_previas = cirugias || null; update.hospitalizaciones_previas = hospitalizaciones || null; }
      if (id === "condiciones_cronicas") update.condiciones_cronicas = condicionesSeleccionadas;
      if (id === "vacunas") { update.vacunas = { lista: vacunasSeleccionadas }; update.vacunas_otras = vacunasOtras || null; }
      if (id === "sueno") { update.sueno_hora_dormir = suenoHoraDormir || null; update.sueno_hora_despertar = suenoHoraDespertar || null; update.sueno_colecho = suenoColecho || null; }
      if (id === "alimentacion") update.alimentacion_notas = alimentacionNotas || null;
      if (id === "entorno") { update.con_quien_vive = conQuienVive || null; update.escuela_regular = escuelaRegular || null; update.hermanos = hermanos || null; }
      if (id === "emergencia") {
        update.contacto_emergencia = { nombre: contactoNombre, telefono: contactoTel, parentesco: contactoParentesco };
        update.hospital_preferencia = hospitalPref || null;
        update.medico_cabecera = medicoCabecera || null;
        update.seguro_medico = seguroMedico || null;
        update.aseguradora = aseguradora || null;
      }
    }

    if (!modoEditar && indice + 1 >= FLUJO.length - 1) update.scouting_completo = true;

    await supabase.from("pacientes").update(update).eq("id", pacienteId);
    setPaciente((prev: any) => ({ ...prev, ...update }));
    avanzar();
    setGuardando(false);
  }

  function avanzar() {
    if (modoEditar) {
      setIndice(FLUJO.length - 1); // regresar directo al resumen
      return;
    }
    const siguiente = indice + 1;
    if (siguiente >= FLUJO.length) { router.push(`/paciente/${pacienteId}`); return; }
    const sig = FLUJO[siguiente];
    if (sig.tipo === "paso") cargarPaso(sig.id, paciente || {});
    setIndice(siguiente);
  }

  function regresar() {
    const anterior = indice - 1;
    if (anterior < 0) return;
    const ant = FLUJO[anterior];
    if (ant.tipo === "paso") cargarPaso(ant.id, paciente || {});
    setIndice(anterior);
  }

  function toggleVacuna(v: string) {
    setVacunasSeleccionadas(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);
  }

  function toggleCondicion(c: string) {
    setCondicionesSeleccionadas(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  function toggleTerapia(t: string) {
    setTerapiasSeleccionadas(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function agregarTag() {
    const val = tagInput.trim();
    if (val && !tags.includes(val)) setTags([...tags, val]);
    setTagInput("");
  }

  function irAPaso(id: string) {
    const idx = FLUJO.findIndex(p => p.tipo === "paso" && p.id === id);
    if (idx >= 0) { cargarPaso(id, paciente); setIndice(idx); }
  }

  const pasosTotales = FLUJO.filter(p => p.tipo === "paso").length;
  const pasosCompletados = FLUJO.slice(0, indice).filter(p => p.tipo === "paso").length;
  const progreso = Math.round((pasosCompletados / pasosTotales) * 100);

  const Nav = () => (
    <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
          <span className="text-white font-bold text-xs">S</span>
        </div>
        <span className="text-slate-800 font-bold text-lg tracking-tight">Syncro<span className="text-[#00C97A]">Medic</span></span>
      </div>
      <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm">Completar después</Link>
    </nav>
  );

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando...</p>
    </main>
  );

  const pantalla = FLUJO[indice];

  if (pantalla.tipo === "intro") return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <Nav />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-6">📋</div>
          <h1 className="text-slate-800 text-2xl font-bold mb-3">Arma el perfil de {paciente?.nombre}</h1>
          <p className="text-slate-500 text-base mb-4">Vamos a hacerte una serie de preguntas sobre tu hijo/a. Esta información la verán todos sus especialistas antes de cada consulta.</p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-left">
            <p className="text-blue-700 text-sm font-medium mb-1">⏱ Este proceso toma aproximadamente 15 minutos</p>
            <p className="text-blue-600 text-sm">Solo se hace una vez. Puedes pausar en cualquier momento — todo se guarda automáticamente.</p>
          </div>
          <button onClick={avanzar} className="w-full bg-[#1A6BFF] hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors text-lg">Empezar →</button>
          <Link href={`/paciente/${pacienteId}`} className="block mt-4 text-slate-400 hover:text-slate-600 text-sm">Lo hago después</Link>
        </div>
      </div>
    </main>
  );

  if (pantalla.tipo === "intermedia") return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <Nav />
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 className="text-slate-800 text-2xl font-bold mb-3">{pantalla.mensaje}</h2>
          <p className="text-slate-500 text-base mb-8">{pantalla.submensaje}</p>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-8">
            <div className="bg-[#1A6BFF] h-2 rounded-full transition-all duration-500" style={{ width: `${progreso}%` }} />
          </div>
          <button onClick={avanzar} className="w-full bg-[#1A6BFF] hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors">Continuar →</button>
          <button onClick={regresar} className="block w-full mt-3 text-slate-400 hover:text-slate-600 text-sm py-2">← Regresar</button>
        </div>
      </div>
    </main>
  );

  if (pantalla.tipo === "resumen") return (
    <main className="min-h-screen bg-slate-50">
      <Nav />
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-slate-800 text-2xl font-bold mb-2">Perfil completado</h1>
          <p className="text-slate-500 text-sm">El expediente de {paciente?.nombre} está listo. Tus doctores ya pueden verlo.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6 flex flex-col">
          <ResumenItem label="Diagnósticos" valor={paciente?.diagnosticos_principales?.join(", ")} onEditar={() => irAPaso("diagnosticos")} />
          <ResumenItem label="Alergias" valor={paciente?.alergias?.join(", ")} onEditar={() => irAPaso("alergias")} />
          <ResumenItem label="Tipo de sangre" valor={paciente?.tipo_sangre} onEditar={() => irAPaso("tipo_sangre")} />
          <ResumenItem label="Lateralidad" valor={paciente?.lateralidad} onEditar={() => irAPaso("lateralidad")} />
          <ResumenItem label="Embarazo de alto riesgo" valor={paciente?.embarazo_alto_riesgo} onEditar={() => irAPaso("embarazo_alto_riesgo")} />
          <ResumenItem
            label="Complicaciones del embarazo"
            valor={[
              paciente?.complicaciones_embarazo && `Complicaciones: ${paciente.complicaciones_embarazo}`,
              paciente?.diabetes_gestacional && `Diabetes gestacional: ${paciente.diabetes_gestacional}`,
            ].filter(Boolean).join(" · ") || null}
            onEditar={() => irAPaso("complicaciones_embarazo")}
          />
          <ResumenItem label="Tipo de parto" valor={paciente?.tipo_parto} onEditar={() => irAPaso("parto")} />
          <ResumenItem label="Peso al nacer" valor={paciente?.peso_nacer} onEditar={() => irAPaso("nacimiento")} />
          <ResumenItem
            label="UCIN y APGAR"
            valor={[
              paciente?.requirio_ucin && `UCIN: ${paciente.requirio_ucin}`,
              paciente?.apgar && `APGAR: ${paciente.apgar}`,
            ].filter(Boolean).join(" · ") || null}
            onEditar={() => irAPaso("ucin_apgar")}
          />
          <ResumenItem
            label="Tamices neonatales"
            valor={[paciente?.tamiz_metabolico, paciente?.tamiz_auditivo, paciente?.tamiz_cardiaco].filter(Boolean).join(" · ") || null}
            onEditar={() => irAPaso("tamices")}
          />
          <ResumenItem
            label="Desarrollo motor"
            valor={paciente?.desarrollo_motor && (paciente.desarrollo_motor.gateo || paciente.desarrollo_motor.camino) ? `Gateo: ${paciente.desarrollo_motor.gateo || "—"} · Caminó: ${paciente.desarrollo_motor.camino || "—"}` : null}
            onEditar={() => irAPaso("desarrollo_motor")}
          />
          <ResumenItem
            label="Desarrollo del lenguaje"
            valor={paciente?.desarrollo_lenguaje?.primeras_palabras ? `Primeras palabras: ${paciente.desarrollo_lenguaje.primeras_palabras}` : null}
            onEditar={() => irAPaso("desarrollo_lenguaje")}
          />
          <ResumenItem label="Terapias actuales" valor={paciente?.terapias_actuales?.join(", ")} onEditar={() => irAPaso("terapias")} />
          <ResumenItem
            label="Antecedentes familiares"
            valor={formatAntecedentesFamiliares(paciente?.antecedentes_familiares_detalle)}
            onEditar={() => irAPaso("antecedentes_familiares")}
          />
          <ResumenItem
            label="Historial médico"
            valor={[paciente?.cirugias_previas, paciente?.hospitalizaciones_previas].filter(Boolean).join(" · ") || null}
            onEditar={() => irAPaso("historial_medico")}
          />
          <ResumenItem label="Condiciones crónicas" valor={paciente?.condiciones_cronicas?.join(", ")} onEditar={() => irAPaso("condiciones_cronicas")} />
          <ResumenItem label="Vacunas registradas" valor={paciente?.vacunas?.lista?.length ? `${paciente.vacunas.lista.length} vacunas` : null} onEditar={() => irAPaso("vacunas")} />
          <ResumenItem label="Sueño" valor={paciente?.sueno_hora_dormir ? `Duerme ${paciente.sueno_hora_dormir} · Despierta ${paciente.sueno_hora_despertar}` : null} onEditar={() => irAPaso("sueno")} />
          <ResumenItem label="Alimentación" valor={paciente?.alimentacion_notas} onEditar={() => irAPaso("alimentacion")} />
          <ResumenItem label="Escuela regular" valor={paciente?.escuela_regular} onEditar={() => irAPaso("entorno")} />
          <ResumenItem label="Con quién vive" valor={paciente?.con_quien_vive} onEditar={() => irAPaso("entorno")} />
          <ResumenItem label="Contacto de emergencia" valor={paciente?.contacto_emergencia?.nombre} onEditar={() => irAPaso("emergencia")} sinBorde />
        </div>
        <button onClick={() => router.push(`/paciente/${pacienteId}`)} className="w-full bg-[#00C97A] hover:bg-green-600 text-white font-semibold py-4 rounded-xl transition-colors">
          Ver expediente completo →
        </button>
      </div>
    </main>
  );

  const pasoId = (pantalla as { tipo: "paso"; id: string }).id;

  return (
    <main className="min-h-screen bg-slate-50">
      <Nav />
      <div className="max-w-xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Perfil base de {paciente?.nombre}</span>
            <span>{progreso}% completado</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div className="bg-[#1A6BFF] h-2 rounded-full transition-all duration-500" style={{ width: `${progreso}%` }} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">

          {pasoId === "diagnosticos" && <PasoTags titulo="Diagnósticos principales" descripcion="¿Cuáles son las condiciones o diagnósticos que tiene tu hijo/a?" ayuda="Agrega uno por uno. Puedes incluir la fecha aproximada entre paréntesis." placeholder="Ej: Autismo nivel 2" tags={tags} tagInput={tagInput} onInputChange={setTagInput} onAgregar={agregarTag} onQuitar={(t: string) => setTags(tags.filter((x: string) => x !== t))} />}

          {pasoId === "alergias" && <PasoTags titulo="Alergias conocidas" descripcion="¿Tu hijo/a tiene alguna alergia conocida?" ayuda="Incluye medicamentos, alimentos o alergias ambientales." placeholder="Ej: Penicilina" tags={tags} tagInput={tagInput} onInputChange={setTagInput} onAgregar={agregarTag} onQuitar={(t: string) => setTags(tags.filter((x: string) => x !== t))} />}

          {pasoId === "tipo_sangre" && <PasoOpciones titulo="Tipo de sangre" descripcion="¿Cuál es el tipo de sangre de tu hijo/a?" opciones={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "No sé"]} valor={selectVal} onChange={setSelectVal} />}

          {pasoId === "lateralidad" && <PasoOpciones titulo="Lateralidad" descripcion="¿Tu hijo/a es...?" opciones={["Diestro/a", "Zurdo/a", "Ambidiestro/a", "No definida aún"]} valor={lateralidad} onChange={setLateralidad} />}

          {pasoId === "embarazo_alto_riesgo" && <PasoOpciones titulo="Embarazo de alto riesgo" descripcion="¿El embarazo fue clasificado como de alto riesgo?" opciones={["Sí", "No", "No sé"]} valor={bool1} onChange={setBool1} />}

          {pasoId === "complicaciones_embarazo" && (
            <div className="flex flex-col gap-6">
              <PasoOpciones titulo="Complicaciones durante el embarazo" descripcion="¿Hubo alguna complicación durante el embarazo?" opciones={["Sí", "No", "No sé"]} valor={bool1} onChange={setBool1} />
              <PasoOpciones titulo="¿Hubo diabetes gestacional?" descripcion="" opciones={["Sí", "No", "No sé"]} valor={bool2} onChange={setBool2} />
            </div>
          )}

          {pasoId === "parto" && (
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-slate-800 text-xl font-semibold mb-1">Semanas de gestación</h2>
                <p className="text-slate-500 text-sm mb-4">¿A cuántas semanas nació tu hijo/a?</p>
                <select value={selectVal} onChange={e => setSelectVal(e.target.value)} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]">
                  <option value="">Seleccionar</option>
                  {Array.from({ length: 20 }, (_, i) => 24 + i).map(s => (
                    <option key={s} value={s}>{s} semanas{s === 37 ? " (término temprano)" : s === 40 ? " (término)" : ""}</option>
                  ))}
                </select>
              </div>
              <PasoOpciones titulo="Tipo de parto" descripcion="¿Cómo fue el nacimiento?" opciones={["Parto natural", "Cesárea programada", "Cesárea de emergencia", "Fórceps o ventosa", "No sé"]} valor={bool1} onChange={setBool1} />
            </div>
          )}

          {pasoId === "nacimiento" && (
            <div className="flex flex-col gap-6">
              <PasoOpciones titulo="Complicaciones al nacer" descripcion="¿Hubo alguna complicación inmediatamente después del nacimiento?" opciones={["Sí", "No", "No sé"]} valor={bool1} onChange={setBool1} />
              <div>
                <p className="text-slate-700 text-base font-semibold mb-2">Peso al nacer</p>
                <input type="text" value={texto1} onChange={e => setTexto1(e.target.value)} placeholder="Ej: 3.2 kg" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
            </div>
          )}

          {pasoId === "ucin_apgar" && (
            <div className="flex flex-col gap-6">
              <PasoOpciones titulo="Incubadora o UCIN" descripcion="¿Tu hijo/a requirió incubadora o UCIN?" opciones={["Sí", "No", "No sé"]} valor={bool1} onChange={setBool1} />
              <div>
                <p className="text-slate-700 text-base font-semibold mb-1">APGAR</p>
                <p className="text-slate-400 text-xs mb-2">Puntuación que le dan al bebé al nacer (1-10). Está en el resumen del hospital.</p>
                <input type="text" value={texto1} onChange={e => setTexto1(e.target.value)} placeholder="Ej: 8/9" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
            </div>
          )}

          {pasoId === "tamices" && (
            <div className="flex flex-col gap-5">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Tamices neonatales</h2>
              <p className="text-slate-500 text-sm mb-2">Pruebas que se hacen al recién nacido en el hospital. Están en el alta o cartilla.</p>
              <PasoOpciones titulo="Tamiz metabólico" descripcion="¿Pasó el tamiz metabólico neonatal?" opciones={["Sí", "No", "Pendiente", "No sé"]} valor={tamizMetabolico} onChange={setTamizMetabolico} />
              <PasoOpciones titulo="Tamiz auditivo" descripcion="¿Pasó el tamiz auditivo?" opciones={["Sí", "No", "Pendiente", "No sé"]} valor={tamizAuditivo} onChange={setTamizAuditivo} />
              <PasoOpciones titulo="Tamiz cardíaco" descripcion="¿Pasó el tamiz cardíaco (oximetría de pulso)?" opciones={["Sí", "No", "Pendiente", "No sé"]} valor={tamizCardiaco} onChange={setTamizCardiaco} />
            </div>
          )}

          {pasoId === "desarrollo_motor" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Desarrollo motor</h2>
              <p className="text-slate-500 text-sm mb-2">Anota la edad aproximada en meses. Si no recuerdas, déjalo en blanco.</p>
              {[
                { label: "¿A qué edad sostuvo la cabeza solo?", val: edadCabeza, set: setEdadCabeza, placeholder: "Ej: 3 meses" },
                { label: "¿A qué edad se sentó sin apoyo?", val: edadSentado, set: setEdadSentado, placeholder: "Ej: 6 meses" },
                { label: "¿A qué edad gateó?", val: edadGateo, set: setEdadGateo, placeholder: "Ej: 9 meses" },
                { label: "¿A qué edad caminó sin ayuda?", val: edadCamino, set: setEdadCamino, placeholder: "Ej: 14 meses" },
              ].map(({ label, val, set, placeholder }) => (
                <div key={label}>
                  <label className="text-slate-600 text-sm mb-1 block">{label}</label>
                  <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={placeholder} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              ))}
              <PasoOpciones titulo="¿Tiene diagnóstico de retraso motor?" descripcion="" opciones={["Sí", "No", "En evaluación"]} valor={retrasoMotor} onChange={setRetrasoMotor} />
            </div>
          )}

          {pasoId === "desarrollo_lenguaje" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Desarrollo del lenguaje</h2>
              <p className="text-slate-500 text-sm mb-2">Anota la edad aproximada en meses.</p>
              <div>
                <label className="text-slate-600 text-sm mb-1 block">¿A qué edad dijo sus primeras palabras con significado?</label>
                <input type="text" value={edadPalabras} onChange={e => setEdadPalabras(e.target.value)} placeholder="Ej: 12 meses" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <PasoOpciones titulo="¿Tiene diagnóstico de retraso en el lenguaje?" descripcion="" opciones={["Sí", "No", "En evaluación"]} valor={retrasoLenguaje} onChange={setRetrasoLenguaje} />
              <PasoOpciones titulo="¿Ha tenido regresiones recientes en el lenguaje?" descripcion="Pérdida de palabras o habilidades que ya tenía" opciones={["Sí", "No"]} valor={regresiones} onChange={setRegresiones} />
            </div>
          )}

          {pasoId === "terapias" && (
            <div>
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Terapias actuales</h2>
              <p className="text-slate-500 text-sm mb-5">¿Tu hijo/a recibe o ha recibido alguna terapia?</p>
              <div className="flex flex-col gap-2">
                {TERAPIAS.map(t => (
                  <button key={t} onClick={() => toggleTerapia(t)} className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-3 ${terapiasSeleccionadas.includes(t) ? "border-[#00C97A] bg-green-50 text-green-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${terapiasSeleccionadas.includes(t) ? "border-[#00C97A] bg-[#00C97A]" : "border-slate-300"}`}>
                      {terapiasSeleccionadas.includes(t) && <span className="text-white text-xs">✓</span>}
                    </span>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pasoId === "antecedentes_familiares" && (
            <div>
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Antecedentes familiares</h2>
              <p className="text-slate-500 text-sm mb-6">Para cada condición, indica quién en la familia directa la tiene.</p>
              <div className="flex flex-col gap-5">
                {ANTECEDENTES_FAMILIARES.map(({ id, label }) => (
                  <div key={id}>
                    <p className="text-slate-700 text-sm font-medium mb-2">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {PARENTESCOS.map(p => (
                        <button key={p} onClick={() => toggleAntFamiliar(id, p)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${(antFamiliares[id] || []).includes(p) ? "bg-[#1A6BFF] border-[#1A6BFF] text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pasoId === "historial_medico" && (
            <div className="flex flex-col gap-5">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Historial médico</h2>
              <div>
                <label className="text-slate-600 text-sm mb-1 block">¿Ha tenido cirugías previas?</label>
                <textarea value={cirugias} onChange={e => setCirugias(e.target.value)} placeholder="Ej: Adenoidectomía (2023), colocación de tubos en oídos (2022)" rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
              </div>
              <div>
                <label className="text-slate-600 text-sm mb-1 block">¿Ha tenido hospitalizaciones previas?</label>
                <textarea value={hospitalizaciones} onChange={e => setHospitalizaciones(e.target.value)} placeholder="Ej: Neumonía (2023), 5 días en Hospital Ángeles" rows={3} className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
              </div>
            </div>
          )}

          {pasoId === "condiciones_cronicas" && (
            <div>
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Condiciones frecuentes o crónicas</h2>
              <p className="text-slate-500 text-sm mb-5">Marca las que tu hijo/a presenta o ha presentado de manera frecuente.</p>
              <div className="flex flex-col gap-2">
                {CONDICIONES_CRONICAS.map(c => (
                  <button key={c} onClick={() => toggleCondicion(c)} className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-3 ${condicionesSeleccionadas.includes(c) ? "border-[#1A6BFF] bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${condicionesSeleccionadas.includes(c) ? "border-[#1A6BFF] bg-[#1A6BFF]" : "border-slate-300"}`}>
                      {condicionesSeleccionadas.includes(c) && <span className="text-white text-xs">✓</span>}
                    </span>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pasoId === "vacunas" && (
            <div>
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Vacunación</h2>
              <p className="text-slate-500 text-sm mb-2">Marca las vacunas que tu hijo/a ya tiene.</p>
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-5">Ten tu cartilla a la mano. Si no la tienes ahorita puedes omitir y completar después.</p>
              <div className="flex flex-col gap-2 mb-5">
                {VACUNAS_MEXICO.map(v => (
                  <button key={v} onClick={() => toggleVacuna(v)} className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-3 ${vacunasSeleccionadas.includes(v) ? "border-[#00C97A] bg-green-50 text-green-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${vacunasSeleccionadas.includes(v) ? "border-[#00C97A] bg-[#00C97A]" : "border-slate-300"}`}>
                      {vacunasSeleccionadas.includes(v) && <span className="text-white text-xs">✓</span>}
                    </span>
                    {v}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Otras vacunas no listadas</label>
                <input type="text" value={vacunasOtras} onChange={e => setVacunasOtras(e.target.value)} placeholder="Ej: Meningocócica B, Rotavirus adicional" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
            </div>
          )}

          {pasoId === "sueno" && (
            <div className="flex flex-col gap-5">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Sueño</h2>
              <p className="text-slate-500 text-sm mb-2">Rutina de sueño habitual de tu hijo/a.</p>
              <div>
                <label className="text-slate-600 text-sm mb-1 block">¿A qué hora se duerme normalmente?</label>
                <input type="text" value={suenoHoraDormir} onChange={e => setSuenoHoraDormir(e.target.value)} placeholder="Ej: 9:00 pm" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <div>
                <label className="text-slate-600 text-sm mb-1 block">¿A qué hora despierta normalmente?</label>
                <input type="text" value={suenoHoraDespertar} onChange={e => setSuenoHoraDespertar(e.target.value)} placeholder="Ej: 7:00 am" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <PasoOpciones titulo="¿Hace colecho?" descripcion="¿Duerme en la misma cama con algún familiar?" opciones={["Sí", "No", "A veces"]} valor={suenoColecho} onChange={setSuenoColecho} />
            </div>
          )}

          {pasoId === "alimentacion" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Alimentación</h2>
              <p className="text-slate-500 text-sm mb-2">Describe brevemente la alimentación de tu hijo/a — restricciones, selectividad o cualquier detalle relevante.</p>
              <textarea
                value={alimentacionNotas}
                onChange={e => setAlimentacionNotas(e.target.value)}
                placeholder="Ej: Come solo ciertos colores de alimentos, rechaza texturas blandas, sin gluten por indicación médica..."
                rows={5}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none"
              />
            </div>
          )}

          {pasoId === "entorno" && (
            <div className="flex flex-col gap-5">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Entorno familiar</h2>
              <div>
                <label className="text-slate-600 text-sm mb-1 block">¿Con quién vive tu hijo/a?</label>
                <input type="text" value={conQuienVive} onChange={e => setConQuienVive(e.target.value)} placeholder="Ej: Papá, mamá y dos hermanos mayores" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <div>
                <label className="text-slate-600 text-sm mb-1 block">Hermanos (edades aproximadas)</label>
                <input type="text" value={hermanos} onChange={e => setHermanos(e.target.value)} placeholder="Ej: Hermana de 10 años, hermano de 5 años" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <PasoOpciones titulo="¿Asiste a escuela regular?" descripcion="" opciones={["Sí, escuela regular", "Sí, escuela especial", "Mixto (regular y apoyo especial)", "No asiste actualmente"]} valor={escuelaRegular} onChange={setEscuelaRegular} />
            </div>
          )}

          {pasoId === "emergencia" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Contacto de emergencia</h2>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Nombre</label>
                <input type="text" value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} placeholder="Ej: María González" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Teléfono</label>
                  <input type="tel" value={contactoTel} onChange={e => setContactoTel(e.target.value)} placeholder="55 1234 5678" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Parentesco</label>
                  <input type="text" value={contactoParentesco} onChange={e => setContactoParentesco(e.target.value)} placeholder="Ej: Tía" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Hospital o clínica de preferencia</label>
                <input type="text" value={hospitalPref} onChange={e => setHospitalPref(e.target.value)} placeholder="Ej: Hospital Ángeles Pedregal" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Médico de cabecera o pediatra</label>
                <input type="text" value={medicoCabecera} onChange={e => setMedicoCabecera(e.target.value)} placeholder="Ej: Dr. Ramírez — Pediatría" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <PasoOpciones titulo="¿Cuenta con seguro médico privado?" descripcion="" opciones={["Sí", "No"]} valor={seguroMedico} onChange={setSeguroMedico} />
              {seguroMedico === "Sí" && (
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Nombre de la aseguradora</label>
                  <input type="text" value={aseguradora} onChange={e => setAseguradora(e.target.value)} placeholder="Ej: GNP, AXA, Metlife" className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-2">
            <button onClick={() => guardarPaso(false)} disabled={guardando} className="w-full bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
              {guardando ? "Guardando..." : "Continuar →"}
            </button>
            <button onClick={() => guardarPaso(true)} disabled={guardando} className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors">
              Contestar más tarde
            </button>
            {indice > 1 && (
              <button onClick={regresar} className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors">
                ← Regresar
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function PasoTags({ titulo, descripcion, ayuda, placeholder, tags, tagInput, onInputChange, onAgregar, onQuitar }: any) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-slate-800 text-xl font-semibold mb-1">{titulo}</h2>
        <p className="text-slate-500 text-sm">{descripcion}</p>
      </div>
      <div className="flex gap-2">
        <input type="text" value={tagInput} onChange={e => onInputChange(e.target.value)} onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && onAgregar()} placeholder={placeholder} className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
        <button onClick={onAgregar} className="bg-[#1A6BFF] text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-700">Agregar</button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((t: string) => (
            <span key={t} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm px-3 py-1.5 rounded-full">
              {t}
              <button onClick={() => onQuitar(t)} className="text-blue-400 hover:text-blue-700 font-bold">×</button>
            </span>
          ))}
        </div>
      )}
      {ayuda && <p className="text-slate-400 text-xs">{ayuda}</p>}
    </div>
  );
}

function PasoOpciones({ titulo, descripcion, opciones, valor, onChange }: any) {
  return (
    <div>
      {titulo && <h2 className="text-slate-800 text-base font-semibold mb-1">{titulo}</h2>}
      {descripcion && <p className="text-slate-500 text-sm mb-3">{descripcion}</p>}
      <div className="flex flex-col gap-2">
        {opciones.map((op: string) => (
          <button key={op} onClick={() => onChange(op)} className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${valor === op ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}

function formatAntecedentesFamiliares(detalle: Record<string, string[]> | undefined) {
  if (!detalle) return null;
  const entradas = Object.entries(detalle).filter(
    ([, parentescos]) => parentescos && parentescos.length > 0 && !(parentescos.length === 1 && parentescos[0] === "Ninguno")
  );
  if (entradas.length === 0) return null;
  return entradas
    .map(([condId, parentescos]) => {
      const label = ANTECEDENTES_FAMILIARES.find(a => a.id === condId)?.label || condId;
      return `${label} (${parentescos.join(", ")})`;
    })
    .join("; ");
}

function ResumenItem({ label, valor, onEditar, sinBorde }: any) {
  return (
    <div className={`flex items-center justify-between py-3 ${!sinBorde ? "border-b border-slate-100" : ""}`}>
      <div>
        <p className="text-slate-500 text-xs">{label}</p>
        <p className="text-slate-800 text-sm font-medium">{valor || <span className="text-slate-300">Sin respuesta</span>}</p>
      </div>
      <button onClick={onEditar} className="text-[#1A6BFF] text-xs hover:underline ml-4">Editar</button>
    </div>
  );
}