"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
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
  { id: "autoinmune", label: "Enfermedades autoinmunes (artritis, lupus, etc.)" },
  { id: "cancer", label: "Cáncer" },
  { id: "neurodesarrollo", label: "Trastornos del neurodesarrollo (autismo, TDAH, etc.)" },
  { id: "mental", label: "Enfermedades mentales (depresión, esquizofrenia, etc.)" },
];

const PARENTESCOS = ["Papá", "Mamá", "Hermano/a", "Abuelo/a paterno/a", "Abuelo/a materno/a", "Ninguno", "No sé"];

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
  { tipo: "intermedia", mensaje: "Vamos bien 👍", submensaje: "Ahora unas preguntas sobre el nacimiento. Ten a la mano cualquier documento del hospital si lo necesitas, pero no es indispensable." },
  { tipo: "paso", id: "embarazo_alto_riesgo" },
  { tipo: "paso", id: "complicaciones_embarazo" },
  { tipo: "paso", id: "parto" },
  { tipo: "paso", id: "nacimiento" },
  { tipo: "paso", id: "ucin_apgar" },
  { tipo: "intermedia", mensaje: "Ya casi 💪", submensaje: "Ahora antecedentes familiares. Responde solo lo que sepas — puedes omitir lo que no recuerdes." },
  { tipo: "paso", id: "antecedentes_familiares" },
  { tipo: "intermedia", mensaje: "Una sección más 📋", submensaje: "Ten tu cartilla de vacunación a la mano para la siguiente parte. Si no la tienes ahorita, puedes omitir y completarla después." },
  { tipo: "paso", id: "vacunas" },
  { tipo: "paso", id: "emergencia" },
  { tipo: "resumen" },
];

export default function ScoutingPage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [indice, setIndice] = useState(0);
  const [paciente, setPaciente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Estado de campos
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectVal, setSelectVal] = useState("");
  const [texto1, setTexto1] = useState("");
  const [texto2, setTexto2] = useState("");
  const [bool1, setBool1] = useState("");
  const [bool2, setBool2] = useState("");
  const [vacunasSeleccionadas, setVacunasSeleccionadas] = useState<string[]>([]);
  const [vacunasOtras, setVacunasOtras] = useState("");
  const [antFamiliares, setAntFamiliares] = useState<Record<string, string>>({});
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTel, setContactoTel] = useState("");
  const [contactoParentesco, setContactoParentesco] = useState("");
  const [hospitalPref, setHospitalPref] = useState("");
  const [medicoCabecera, setMedicoCabecera] = useState("");

  useEffect(() => { cargarPaciente(); }, []);

  async function cargarPaciente() {
    const { data } = await supabase.from("pacientes").select("*").eq("id", pacienteId).single();
    if (data) {
      setPaciente(data);
      const pasoGuardado = data.scouting_paso || 0;
      // Encontrar el índice correspondiente al paso guardado
      const idx = Math.min(pasoGuardado, FLUJO.length - 1);
      setIndice(idx);
      cargarEstado(data);
    }
    setLoading(false);
  }

  function cargarEstado(data: any) {
    setTags(data.diagnosticos_principales || []);
    setVacunasSeleccionadas(data.vacunas?.lista || []);
    setVacunasOtras(data.vacunas_otras || "");
    setAntFamiliares(data.antecedentes_familiares_detalle || {});
    const c = data.contacto_emergencia || {};
    setContactoNombre(c.nombre || "");
    setContactoTel(c.telefono || "");
    setContactoParentesco(c.parentesco || "");
    setHospitalPref(data.hospital_preferencia || "");
    setMedicoCabecera(data.medico_cabecera || "");
  }

  function limpiarCampos() {
    setTagInput(""); setSelectVal(""); setTexto1(""); setTexto2(""); setBool1(""); setBool2("");
  }

  function cargarPaso(id: string, data: any) {
    limpiarCampos();
    if (id === "diagnosticos") setTags(data.diagnosticos_principales || []);
    if (id === "alergias") setTags(data.alergias || []);
    if (id === "tipo_sangre") setSelectVal(data.tipo_sangre || "");
    if (id === "embarazo_alto_riesgo") setBool1(data.embarazo_alto_riesgo || "");
    if (id === "complicaciones_embarazo") { setBool1(data.complicaciones_embarazo || ""); setSelectVal(data.diabetes_gestacional || ""); }
    if (id === "parto") { setSelectVal(data.semanas_gestacion?.toString() || ""); setBool1(data.tipo_parto || ""); }
    if (id === "nacimiento") { setBool1(data.complicaciones_nacimiento || ""); setTexto1(data.peso_nacer || ""); }
    if (id === "ucin_apgar") { setBool1(data.requirio_ucin || ""); setTexto1(data.apgar || ""); }
  }

  async function guardarPaso(omitir = false) {
    setGuardando(true);
    const pantalla = FLUJO[indice];
    if (pantalla.tipo !== "paso") { avanzar(); setGuardando(false); return; }

    const id = pantalla.id;
    let update: any = { scouting_paso: indice + 1, updated_at: new Date().toISOString() };

    if (!omitir) {
      if (id === "diagnosticos") update.diagnosticos_principales = tags;
      if (id === "alergias") update.alergias = tags;
      if (id === "tipo_sangre") update.tipo_sangre = selectVal || null;
      if (id === "embarazo_alto_riesgo") update.embarazo_alto_riesgo = bool1 || null;
      if (id === "complicaciones_embarazo") { update.complicaciones_embarazo = bool1 || null; update.diabetes_gestacional = selectVal || null; }
      if (id === "parto") { update.semanas_gestacion = selectVal ? parseInt(selectVal) : null; update.tipo_parto = bool1 || null; }
      if (id === "nacimiento") { update.complicaciones_nacimiento = bool1 || null; update.peso_nacer = texto1 || null; }
      if (id === "ucin_apgar") { update.requirio_ucin = bool1 || null; update.apgar = texto1 || null; }
      if (id === "antecedentes_familiares") update.antecedentes_familiares_detalle = antFamiliares;
      if (id === "vacunas") { update.vacunas = { lista: vacunasSeleccionadas }; update.vacunas_otras = vacunasOtras || null; }
      if (id === "emergencia") {
        update.contacto_emergencia = { nombre: contactoNombre, telefono: contactoTel, parentesco: contactoParentesco };
        update.hospital_preferencia = hospitalPref || null;
        update.medico_cabecera = medicoCabecera || null;
      }
    }

    const esUltimoPaso = indice + 1 >= FLUJO.length - 1;
    if (esUltimoPaso) update.scouting_completo = true;

    await supabase.from("pacientes").update(update).eq("id", pacienteId);
    setPaciente((prev: any) => ({ ...prev, ...update }));
    avanzar();
    setGuardando(false);
  }

  function avanzar() {
    const siguiente = indice + 1;
    if (siguiente >= FLUJO.length) {
      router.push(`/paciente/${pacienteId}`);
      return;
    }
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

  function toggleAntFamiliar(condId: string, parentesco: string) {
    setAntFamiliares(prev => ({ ...prev, [condId]: parentesco }));
  }

  function agregarTag() {
    const val = tagInput.trim();
    if (val && !tags.includes(val)) setTags([...tags, val]);
    setTagInput("");
  }

  // Calcular progreso solo con pasos reales
  const pasosTotales = FLUJO.filter(p => p.tipo === "paso").length;
  const pasosCompletados = FLUJO.slice(0, indice).filter(p => p.tipo === "paso").length;
  const progreso = Math.round((pasosCompletados / pasosTotales) * 100);

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando...</p>
    </main>
  );

  const pantalla = FLUJO[indice];

  // ── INTRO ──────────────────────────────────────────────
  if (pantalla.tipo === "intro") return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">Syncro<span className="text-[#00C97A]">Medic</span></span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm">Completar después</Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-6">📋</div>
          <h1 className="text-slate-800 text-2xl font-bold mb-3">Arma el perfil de {paciente?.nombre}</h1>
          <p className="text-slate-500 text-base mb-4">
            Vamos a hacerte una serie de preguntas sobre tu hijo/a. La información que nos des la verán todos sus especialistas antes de cada consulta.
          </p>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-left">
            <p className="text-blue-700 text-sm font-medium mb-1">⏱ Este proceso toma aproximadamente 10 minutos</p>
            <p className="text-blue-600 text-sm">Solo se hace una vez. Puedes pausar en cualquier momento y continuar después — todo se guarda automáticamente.</p>
          </div>
          <button onClick={avanzar} className="w-full bg-[#1A6BFF] hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors text-lg">
            Empezar →
          </button>
          <Link href={`/paciente/${pacienteId}`} className="block mt-4 text-slate-400 hover:text-slate-600 text-sm">
            Lo hago después
          </Link>
        </div>
      </div>
    </main>
  );

  // ── PANTALLA INTERMEDIA ────────────────────────────────
  if (pantalla.tipo === "intermedia") return (
    <main className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">Syncro<span className="text-[#00C97A]">Medic</span></span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm">Completar después</Link>
      </nav>
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <h2 className="text-slate-800 text-2xl font-bold mb-3">{pantalla.mensaje}</h2>
          <p className="text-slate-500 text-base mb-8">{pantalla.submensaje}</p>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-8">
            <div className="bg-[#1A6BFF] h-2 rounded-full transition-all duration-500" style={{ width: `${progreso}%` }} />
          </div>
          <button onClick={avanzar} className="w-full bg-[#1A6BFF] hover:bg-blue-700 text-white font-semibold py-4 rounded-xl transition-colors">
            Continuar →
          </button>
          <button onClick={regresar} className="block w-full mt-3 text-slate-400 hover:text-slate-600 text-sm py-2">
            ← Regresar
          </button>
        </div>
      </div>
    </main>
  );

  // ── RESUMEN ────────────────────────────────────────────
  if (pantalla.tipo === "resumen") return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">Syncro<span className="text-[#00C97A]">Medic</span></span>
        </div>
      </nav>
      <div className="max-w-xl mx-auto px-6 py-10">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-slate-800 text-2xl font-bold mb-2">Perfil completado</h1>
          <p className="text-slate-500 text-sm">El expediente de {paciente?.nombre} está listo. Tus doctores ya pueden verlo.</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
          <ResumenItem label="Diagnósticos" valor={paciente?.diagnosticos_principales?.join(", ")} onEditar={() => irAPaso("diagnosticos")} />
          <ResumenItem label="Alergias" valor={paciente?.alergias?.join(", ")} onEditar={() => irAPaso("alergias")} />
          <ResumenItem label="Tipo de sangre" valor={paciente?.tipo_sangre} onEditar={() => irAPaso("tipo_sangre")} />
          <ResumenItem label="Embarazo alto riesgo" valor={paciente?.embarazo_alto_riesgo} onEditar={() => irAPaso("embarazo_alto_riesgo")} />
          <ResumenItem label="Tipo de parto" valor={paciente?.tipo_parto} onEditar={() => irAPaso("parto")} />
          <ResumenItem label="Semanas al nacer" valor={paciente?.semanas_gestacion ? `${paciente.semanas_gestacion} semanas` : null} onEditar={() => irAPaso("parto")} />
          <ResumenItem label="Peso al nacer" valor={paciente?.peso_nacer} onEditar={() => irAPaso("nacimiento")} />
          <ResumenItem label="APGAR" valor={paciente?.apgar} onEditar={() => irAPaso("ucin_apgar")} />
          <ResumenItem label="Vacunas registradas" valor={paciente?.vacunas?.lista?.length ? `${paciente.vacunas.lista.length} vacunas` : null} onEditar={() => irAPaso("vacunas")} />
          <ResumenItem label="Contacto de emergencia" valor={paciente?.contacto_emergencia?.nombre} onEditar={() => irAPaso("emergencia")} sinBorde />
        </div>
        <button onClick={() => router.push(`/paciente/${pacienteId}`)} className="w-full bg-[#00C97A] hover:bg-green-600 text-white font-semibold py-4 rounded-xl transition-colors">
          Ver expediente completo →
        </button>
      </div>
    </main>
  );

  function irAPaso(id: string) {
    const idx = FLUJO.findIndex(p => p.tipo === "paso" && p.id === id);
    if (idx >= 0) { cargarPaso(id, paciente); setIndice(idx); }
  }

  // ── PASO ──────────────────────────────────────────────
  const pasoId = (pantalla as { tipo: "paso"; id: string }).id;

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">Syncro<span className="text-[#00C97A]">Medic</span></span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm">Completar después</Link>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-8">
        {/* Progreso */}
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

          {/* DIAGNÓSTICOS */}
          {pasoId === "diagnosticos" && (
            <PasoTags
              titulo="Diagnósticos principales"
              descripcion="¿Cuáles son las condiciones o diagnósticos que tiene tu hijo/a?"
              ayuda="Agrega uno por uno. Puedes incluir la fecha aproximada entre paréntesis."
              placeholder="Ej: Autismo nivel 2"
              tags={tags} tagInput={tagInput}
              onInputChange={setTagInput}
              onAgregar={agregarTag}
              onQuitar={t => setTags(tags.filter(x => x !== t))}
            />
          )}

          {/* ALERGIAS */}
          {pasoId === "alergias" && (
            <PasoTags
              titulo="Alergias conocidas"
              descripcion="¿Tu hijo/a tiene alguna alergia conocida?"
              ayuda="Incluye medicamentos, alimentos o alergias ambientales."
              placeholder="Ej: Penicilina"
              tags={tags} tagInput={tagInput}
              onInputChange={setTagInput}
              onAgregar={agregarTag}
              onQuitar={t => setTags(tags.filter(x => x !== t))}
            />
          )}

          {/* TIPO DE SANGRE */}
          {pasoId === "tipo_sangre" && (
            <PasoOpciones
              titulo="Tipo de sangre"
              descripcion="¿Cuál es el tipo de sangre de tu hijo/a?"
              opciones={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "No sé"]}
              valor={selectVal}
              onChange={setSelectVal}
            />
          )}

          {/* EMBARAZO ALTO RIESGO */}
          {pasoId === "embarazo_alto_riesgo" && (
            <PasoOpciones
              titulo="Embarazo de alto riesgo"
              descripcion="¿El embarazo fue clasificado como de alto riesgo?"
              opciones={["Sí", "No", "No sé"]}
              valor={bool1}
              onChange={setBool1}
            />
          )}

          {/* COMPLICACIONES EMBARAZO */}
          {pasoId === "complicaciones_embarazo" && (
            <div className="flex flex-col gap-6">
              <PasoOpciones
                titulo="Complicaciones durante el embarazo"
                descripcion="¿Hubo alguna complicación durante el embarazo?"
                opciones={["Sí", "No", "No sé"]}
                valor={bool1}
                onChange={setBool1}
              />
              <div>
                <p className="text-slate-700 text-base font-semibold mb-1">¿Hubo diabetes gestacional?</p>
                <div className="flex flex-col gap-2 mt-2">
                  {["Sí", "No", "No sé"].map(op => (
                    <button key={op} onClick={() => setSelectVal(op)}
                      className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${selectVal === op ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                      {op}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PARTO */}
          {pasoId === "parto" && (
            <div className="flex flex-col gap-6">
              <div>
                <p className="text-slate-800 text-xl font-semibold mb-1">Semanas de gestación</p>
                <p className="text-slate-500 text-sm mb-4">¿A cuántas semanas nació tu hijo/a?</p>
                <select value={selectVal} onChange={e => setSelectVal(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]">
                  <option value="">Seleccionar</option>
                  {Array.from({ length: 20 }, (_, i) => 24 + i).map(s => (
                    <option key={s} value={s}>{s} semanas{s === 37 ? " (término temprano)" : s === 40 ? " (término)" : ""}</option>
                  ))}
                </select>
              </div>
              <PasoOpciones
                titulo="Tipo de parto"
                descripcion="¿Cómo fue el nacimiento?"
                opciones={["Parto natural", "Cesárea programada", "Cesárea de emergencia", "Fórceps o ventosa", "No sé"]}
                valor={bool1}
                onChange={setBool1}
              />
            </div>
          )}

          {/* NACIMIENTO */}
          {pasoId === "nacimiento" && (
            <div className="flex flex-col gap-6">
              <PasoOpciones
                titulo="Complicaciones al nacer"
                descripcion="¿Hubo alguna complicación inmediatamente después del nacimiento?"
                opciones={["Sí", "No", "No sé"]}
                valor={bool1}
                onChange={setBool1}
              />
              <div>
                <p className="text-slate-700 text-base font-semibold mb-1">Peso al nacer</p>
                <input type="text" value={texto1} onChange={e => setTexto1(e.target.value)}
                  placeholder="Ej: 3.2 kg"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
            </div>
          )}

          {/* UCIN / APGAR */}
          {pasoId === "ucin_apgar" && (
            <div className="flex flex-col gap-6">
              <PasoOpciones
                titulo="Incubadora o UCIN"
                descripcion="¿Tu hijo/a requirió incubadora o unidad de cuidados intensivos neonatales (UCIN)?"
                opciones={["Sí", "No", "No sé"]}
                valor={bool1}
                onChange={setBool1}
              />
              <div>
                <p className="text-slate-700 text-base font-semibold mb-1">APGAR</p>
                <p className="text-slate-400 text-xs mb-2">Es la puntuación que le dan al bebé al nacer (del 1 al 10). Está en el resumen del hospital si lo tienes.</p>
                <input type="text" value={texto1} onChange={e => setTexto1(e.target.value)}
                  placeholder="Ej: 8/9 o 'No recuerdo'"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
            </div>
          )}

          {/* ANTECEDENTES FAMILIARES */}
          {pasoId === "antecedentes_familiares" && (
            <div>
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Antecedentes familiares</h2>
              <p className="text-slate-500 text-sm mb-6">Para cada condición, indica si alguien en la familia directa la tiene.</p>
              <div className="flex flex-col gap-5">
                {ANTECEDENTES_FAMILIARES.map(({ id, label }) => (
                  <div key={id}>
                    <p className="text-slate-700 text-sm font-medium mb-2">{label}</p>
                    <div className="flex flex-wrap gap-2">
                      {PARENTESCOS.map(p => (
                        <button key={p} onClick={() => toggleAntFamiliar(id, antFamiliares[id] === p ? "" : p)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${antFamiliares[id] === p ? "bg-[#1A6BFF] border-[#1A6BFF] text-white" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VACUNAS */}
          {pasoId === "vacunas" && (
            <div>
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Vacunación</h2>
              <p className="text-slate-500 text-sm mb-2">Marca las vacunas que tu hijo/a ya tiene. Ten tu cartilla a la mano si puedes.</p>
              <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2 mb-5">Si no tienes la cartilla ahorita, puedes omitir y completar después.</p>
              <div className="flex flex-col gap-2 mb-5">
                {VACUNAS_MEXICO.map(v => (
                  <button key={v} onClick={() => toggleVacuna(v)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors flex items-center gap-3 ${vacunasSeleccionadas.includes(v) ? "border-[#00C97A] bg-green-50 text-green-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${vacunasSeleccionadas.includes(v) ? "border-[#00C97A] bg-[#00C97A]" : "border-slate-300"}`}>
                      {vacunasSeleccionadas.includes(v) && <span className="text-white text-xs">✓</span>}
                    </span>
                    {v}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Otras vacunas no listadas</label>
                <input type="text" value={vacunasOtras} onChange={e => setVacunasOtras(e.target.value)}
                  placeholder="Ej: Varicela refuerzo, Meningocócica B"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
            </div>
          )}

          {/* EMERGENCIA */}
          {pasoId === "emergencia" && (
            <div className="flex flex-col gap-4">
              <h2 className="text-slate-800 text-xl font-semibold mb-1">Contacto de emergencia</h2>
              <p className="text-slate-500 text-sm mb-2">¿A quién contactamos en caso de emergencia?</p>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Nombre</label>
                <input type="text" value={contactoNombre} onChange={e => setContactoNombre(e.target.value)}
                  placeholder="Ej: María González"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Teléfono</label>
                  <input type="tel" value={contactoTel} onChange={e => setContactoTel(e.target.value)}
                    placeholder="55 1234 5678"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Parentesco</label>
                  <input type="text" value={contactoParentesco} onChange={e => setContactoParentesco(e.target.value)}
                    placeholder="Ej: Mamá"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Hospital o clínica de preferencia</label>
                <input type="text" value={hospitalPref} onChange={e => setHospitalPref(e.target.value)}
                  placeholder="Ej: Hospital Ángeles Pedregal"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Médico de cabecera o pediatra</label>
                <input type="text" value={medicoCabecera} onChange={e => setMedicoCabecera(e.target.value)}
                  placeholder="Ej: Dr. Ramírez — Pediatría"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="mt-8 flex flex-col gap-2">
            <button onClick={() => guardarPaso(false)} disabled={guardando}
              className="w-full bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
              {guardando ? "Guardando..." : "Continuar →"}
            </button>
            <button onClick={() => guardarPaso(true)} disabled={guardando}
              className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors">
              Contestar más tarde
            </button>
            {indice > 1 && (
              <button onClick={regresar}
                className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors">
                ← Regresar
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// ── COMPONENTES AUXILIARES ─────────────────────────────

function PasoTags({ titulo, descripcion, ayuda, placeholder, tags, tagInput, onInputChange, onAgregar, onQuitar }: any) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-slate-800 text-xl font-semibold mb-1">{titulo}</h2>
        <p className="text-slate-500 text-sm">{descripcion}</p>
      </div>
      <div className="flex gap-2">
        <input type="text" value={tagInput} onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onAgregar()}
          placeholder={placeholder}
          className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
        <button onClick={onAgregar} className="bg-[#1A6BFF] text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-700">
          Agregar
        </button>
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
      <h2 className="text-slate-800 text-xl font-semibold mb-1">{titulo}</h2>
      <p className="text-slate-500 text-sm mb-4">{descripcion}</p>
      <div className="flex flex-col gap-2">
        {opciones.map((op: string) => (
          <button key={op} onClick={() => onChange(op)}
            className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${valor === op ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
            {op}
          </button>
        ))}
      </div>
    </div>
  );
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