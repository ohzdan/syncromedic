"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

const TOTAL_PASOS = 8;

const BLOQUES = [
  {
    titulo: "Diagnósticos principales",
    descripcion: "¿Cuáles son las condiciones o diagnósticos que tiene tu hijo/a?",
    campo: "diagnosticos_principales",
    tipo: "tags",
    placeholder: "Ej: Autismo nivel 2",
    ayuda: "Agrega uno por uno. Puedes incluir la fecha aproximada de diagnóstico entre paréntesis.",
  },
  {
    titulo: "Alergias conocidas",
    descripcion: "¿Tu hijo/a tiene alguna alergia conocida?",
    campo: "alergias",
    tipo: "tags",
    placeholder: "Ej: Penicilina",
    ayuda: "Incluye medicamentos, alimentos o alergias ambientales. Si no tiene, puedes continuar.",
  },
  {
    titulo: "Tipo de sangre",
    descripcion: "¿Cuál es el tipo de sangre de tu hijo/a?",
    campo: "tipo_sangre",
    tipo: "select",
    opciones: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "No sé"],
  },
  {
    titulo: "Antecedentes perinatales",
    descripcion: "Cuéntanos sobre el embarazo y nacimiento",
    campo: "antecedentes_perinatales",
    tipo: "textarea",
    placeholder: "Ej: Parto por cesárea a las 38 semanas. Peso al nacer 3.2 kg. Sin complicaciones inmediatas.",
    ayuda: "Esta información es muy útil para neurólogos y pediatras. Incluye lo que recuerdes.",
  },
  {
    titulo: "Antecedentes familiares",
    descripcion: "¿Hay condiciones de salud relevantes en la familia directa?",
    campo: "antecedentes_familiares",
    tipo: "textarea",
    placeholder: "Ej: Papá con epilepsia. Abuela materna con diabetes tipo 2.",
    ayuda: "Condiciones en papá, mamá, hermanos o abuelos que puedan ser relevantes.",
  },
  {
    titulo: "Medicamentos actuales",
    descripcion: "¿Tu hijo/a toma algún medicamento actualmente?",
    campo: null,
    tipo: "info",
    mensaje: "Los medicamentos se gestionan en la sección de Medicamentos Activos del expediente. Podrás agregarlos ahí con dosis, frecuencia y médico que los indicó.",
  },
  {
    titulo: "Vacunación",
    descripcion: "¿Cómo está el esquema de vacunación?",
    campo: "vacunacion_status",
    tipo: "select",
    opciones: ["Completo para su edad", "Incompleto", "No lo sé con certeza"],
  },
  {
    titulo: "Contacto de emergencia y preferencias",
    descripcion: "Información de emergencia y preferencias médicas",
    campo: "multi",
    tipo: "emergencia",
  },
];

export default function ScoutingPage() {
  const params = useParams();
  const pacienteId = params.id as string;
  const router = useRouter();
  const supabase = createClient();

  const [paso, setPaso] = useState(0);
  const [paciente, setPaciente] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  // Valores por bloque
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selectVal, setSelectVal] = useState("");
  const [textareaVal, setTextareaVal] = useState("");
  const [contactoNombre, setContactoNombre] = useState("");
  const [contactoTel, setContactoTel] = useState("");
  const [contactoParentesco, setContactoParentesco] = useState("");
  const [hospitalPref, setHospitalPref] = useState("");
  const [medicoCabecera, setMedicoCabecera] = useState("");

  useEffect(() => {
    cargarPaciente();
  }, []);

  async function cargarPaciente() {
    const { data } = await supabase
      .from("pacientes")
      .select("*")
      .eq("id", pacienteId)
      .single();

    if (data) {
      setPaciente(data);
      const pasoGuardado = data.scouting_paso || 0;
      setPaso(pasoGuardado);
      cargarValoresPaso(pasoGuardado, data);
    }
    setLoading(false);
  }

  function cargarValoresPaso(p: number, data: any) {
    const bloque = BLOQUES[p];
    if (!bloque) return;

    if (bloque.tipo === "tags") {
      setTags(data[bloque.campo!] || []);
      setTagInput("");
    } else if (bloque.tipo === "select") {
      setSelectVal(data[bloque.campo!] || "");
    } else if (bloque.tipo === "textarea") {
      setTextareaVal(data[bloque.campo!] || "");
    } else if (bloque.tipo === "emergencia") {
      const c = data.contacto_emergencia || {};
      setContactoNombre(c.nombre || "");
      setContactoTel(c.telefono || "");
      setContactoParentesco(c.parentesco || "");
      setHospitalPref(data.hospital_preferencia || "");
      setMedicoCabecera(data.medico_cabecera || "");
    }
  }

  function agregarTag() {
    const val = tagInput.trim();
    if (val && !tags.includes(val)) {
      setTags([...tags, val]);
    }
    setTagInput("");
  }

  function quitarTag(t: string) {
    setTags(tags.filter(x => x !== t));
  }

  async function guardarYAvanzar() {
    setGuardando(true);
    const bloque = BLOQUES[paso];
    const siguientePaso = paso + 1;
    const esUltimo = siguientePaso >= TOTAL_PASOS;

    let update: any = {
      scouting_paso: esUltimo ? TOTAL_PASOS : siguientePaso,
      scouting_completo: esUltimo,
      updated_at: new Date().toISOString(),
    };

    if (bloque.tipo === "tags" && bloque.campo) {
      update[bloque.campo] = tags;
    } else if (bloque.tipo === "select" && bloque.campo) {
      update[bloque.campo] = selectVal || null;
    } else if (bloque.tipo === "textarea" && bloque.campo) {
      update[bloque.campo] = textareaVal || null;
    } else if (bloque.tipo === "emergencia") {
      update.contacto_emergencia = {
        nombre: contactoNombre,
        telefono: contactoTel,
        parentesco: contactoParentesco,
      };
      update.hospital_preferencia = hospitalPref || null;
      update.medico_cabecera = medicoCabecera || null;
    }

    await supabase.from("pacientes").update(update).eq("id", pacienteId);

    if (esUltimo) {
      router.push(`/paciente/${pacienteId}`);
    } else {
      const nuevoPaciente = { ...paciente, ...update };
      setPaciente(nuevoPaciente);
      setPaso(siguientePaso);
      cargarValoresPaso(siguientePaso, nuevoPaciente);
    }
    setGuardando(false);
  }

  async function irAPaso(p: number) {
    if (p < paso || p <= (paciente?.scouting_paso || 0)) {
      setPaso(p);
      cargarValoresPaso(p, paciente);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  const bloque = BLOQUES[paso];
  const progreso = Math.round((paso / TOTAL_PASOS) * 100);

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Nav */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-800 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </div>
        <Link href={`/paciente/${pacienteId}`} className="text-slate-400 hover:text-slate-600 text-sm transition-colors">
          Completar después
        </Link>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <p className="text-sm text-slate-400 mb-1">Perfil base de {paciente?.nombre}</p>
          <h1 className="text-slate-800 text-2xl font-semibold">Conozcamos a tu hijo/a</h1>
          <p className="text-slate-500 text-sm mt-1">
            Esta información la verán todos los especialistas antes de cada consulta. Puedes pausar y continuar cuando quieras.
          </p>
        </div>

        {/* Barra de progreso */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Paso {paso + 1} de {TOTAL_PASOS}</span>
            <span>{progreso}% completado</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-[#1A6BFF] h-2 rounded-full transition-all duration-500"
              style={{ width: `${progreso}%` }}
            />
          </div>

          {/* Pasos navegables */}
          <div className="flex gap-1.5 mt-3">
            {BLOQUES.map((_, i) => (
              <button
                key={i}
                onClick={() => irAPaso(i)}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  i < paso
                    ? "bg-[#00C97A] cursor-pointer"
                    : i === paso
                    ? "bg-[#1A6BFF]"
                    : "bg-slate-200 cursor-default"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Tarjeta del bloque */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <h2 className="text-slate-800 text-xl font-semibold mb-1">{bloque.titulo}</h2>
          <p className="text-slate-500 text-sm mb-6">{bloque.descripcion}</p>

          {/* TAGS */}
          {bloque.tipo === "tags" && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && agregarTag()}
                  placeholder={bloque.placeholder}
                  className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                />
                <button
                  onClick={agregarTag}
                  className="bg-[#1A6BFF] text-white px-4 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Agregar
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(t => (
                    <span key={t} className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-sm px-3 py-1.5 rounded-full">
                      {t}
                      <button onClick={() => quitarTag(t)} className="text-blue-400 hover:text-blue-700 font-bold">×</button>
                    </span>
                  ))}
                </div>
              )}
              {bloque.ayuda && <p className="text-slate-400 text-xs">{bloque.ayuda}</p>}
            </div>
          )}

          {/* SELECT */}
          {bloque.tipo === "select" && (
            <div className="flex flex-col gap-3">
              {bloque.opciones?.map(op => (
                <button
                  key={op}
                  onClick={() => setSelectVal(op)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                    selectVal === op
                      ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {op}
                </button>
              ))}
            </div>
          )}

          {/* TEXTAREA */}
          {bloque.tipo === "textarea" && (
            <div className="flex flex-col gap-3">
              <textarea
                value={textareaVal}
                onChange={e => setTextareaVal(e.target.value)}
                placeholder={bloque.placeholder}
                rows={4}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors resize-none"
              />
              {bloque.ayuda && <p className="text-slate-400 text-xs">{bloque.ayuda}</p>}
            </div>
          )}

          {/* INFO */}
          {bloque.tipo === "info" && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-blue-700 text-sm">{bloque.mensaje}</p>
            </div>
          )}

          {/* EMERGENCIA */}
          {bloque.tipo === "emergencia" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Nombre del contacto de emergencia</label>
                <input
                  type="text"
                  value={contactoNombre}
                  onChange={e => setContactoNombre(e.target.value)}
                  placeholder="Ej: María González"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Teléfono</label>
                  <input
                    type="tel"
                    value={contactoTel}
                    onChange={e => setContactoTel(e.target.value)}
                    placeholder="55 1234 5678"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-slate-500 text-xs mb-1 block">Parentesco</label>
                  <input
                    type="text"
                    value={contactoParentesco}
                    onChange={e => setContactoParentesco(e.target.value)}
                    placeholder="Ej: Mamá"
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Hospital o clínica de preferencia</label>
                <input
                  type="text"
                  value={hospitalPref}
                  onChange={e => setHospitalPref(e.target.value)}
                  placeholder="Ej: Hospital Ángeles Pedregal"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                />
              </div>
              <div>
                <label className="text-slate-500 text-xs mb-1 block">Médico de cabecera o pediatra</label>
                <input
                  type="text"
                  value={medicoCabecera}
                  onChange={e => setMedicoCabecera(e.target.value)}
                  placeholder="Ej: Dr. Ramírez — Pediatría"
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] transition-colors"
                />
              </div>
            </div>
          )}

          {/* Botón avanzar */}
          <button
            onClick={guardarYAvanzar}
            disabled={guardando}
            className="w-full mt-8 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {guardando
              ? "Guardando..."
              : paso + 1 >= TOTAL_PASOS
              ? "Finalizar perfil"
              : "Continuar →"}
          </button>

          {paso > 0 && (
            <button
              onClick={() => { setPaso(paso - 1); cargarValoresPaso(paso - 1, paciente); }}
              className="w-full mt-2 text-slate-400 hover:text-slate-600 text-sm py-2 transition-colors"
            >
              ← Regresar
            </button>
          )}
        </div>
      </div>
    </main>
  );
}