"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'
type Consistencia = 'normal' | 'blanda' | 'dura' | 'diarrea'

const CONSISTENCIA_LABELS: Record<Consistencia, string> = {
  normal: 'Normal',
  blanda: 'Blanda',
  dura: 'Dura',
  diarrea: 'Diarrea',
}

const MOTIVOS = [
  { value: 'terror_nocturno', label: 'Terror nocturno' },
  { value: 'pesadilla', label: 'Pesadilla' },
  { value: 'hambre_sed', label: 'Hambre o sed' },
  { value: 'bano_panal', label: 'Necesidad de ir al baño / pañal' },
  { value: 'dolor', label: 'Dolor o malestar físico' },
  { value: 'enfermedad', label: 'Enfermedad (fiebre, tos, congestión)' },
  { value: 'convulsion', label: 'Convulsión' },
  { value: 'ruido_ambiental', label: 'Ruido o estímulo ambiental' },
  { value: 'ansiedad_separacion', label: 'Ansiedad de separación' },
  { value: 'sin_causa', label: 'Sin causa aparente' },
]

function horaHHMM(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Construye un timestamp ISO a partir de una fecha base y una hora (HH:MM).
 * Si se da una hora de referencia y la hora nueva es "menor" en el reloj,
 * asumimos que cruzó la medianoche y sumamos un día.
 */
function construirFechaHora(fechaBase: string, horaHHMM_: string, horaReferencia?: string) {
  let fecha = fechaBase
  if (horaReferencia && horaHHMM_ < horaReferencia) {
    const d = new Date(fechaBase + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    fecha = d.toISOString().slice(0, 10)
  }
  return `${fecha}T${horaHHMM_}:00`
}

function hoyISO() {
  return new Date().toISOString().split('T')[0]
}

function sumarDias(fechaISO: string, dias: number) {
  const d = new Date(fechaISO + 'T12:00:00')
  d.setDate(d.getDate() + dias)
  return d.toISOString().split('T')[0]
}

function formatFechaCorta(fechaISO: string) {
  return new Date(fechaISO + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

export default function ExpedientePaciente() {
  const [paciente, setPaciente] = useState<any>(null);
  const [rol, setRol] = useState<Rol>('familia');
  const [permisosEscuela, setPermisosEscuela] = useState({ puede_ver_medicamentos: false, puede_ver_timeline: false });
  const [loading, setLoading] = useState(true);
  const [editandoApodo, setEditandoApodo] = useState(false);
  const [apodoInput, setApodoInput] = useState("");
  const [guardandoApodo, setGuardandoApodo] = useState(false);
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const fotoEvacInputRef = useRef<HTMLInputElement>(null);

  // Diario combinado (sueño + evacuación + pipi nocturno)
  const [diarioAbierto, setDiarioAbierto] = useState(false);
  const [fechaDormir, setFechaDormir] = useState(sumarDias(hoyISO(), -1));
  const [horaDormir, setHoraDormir] = useState('20:40');
  const [fechaDespertar, setFechaDespertar] = useState(hoyISO());
  const [horaDespertar, setHoraDespertar] = useState('06:50');
  const [diarioPipi, setDiarioPipi] = useState(false);
  const [fechaPipi, setFechaPipi] = useState(hoyISO());
  const [diarioTuvoEvacuacion, setDiarioTuvoEvacuacion] = useState(false);
  const [fechaEvacuacion, setFechaEvacuacion] = useState(sumarDias(hoyISO(), -1));
  const [diarioConsistencia, setDiarioConsistencia] = useState<Consistencia>('normal');
  const [fotoEvacuacion, setFotoEvacuacion] = useState<File | null>(null);
  const [previewEvacuacion, setPreviewEvacuacion] = useState<string | null>(null);
  const [notaSueno, setNotaSueno] = useState('');
  const [notaEvacuacion, setNotaEvacuacion] = useState('');
  const [despertares, setDespertares] = useState<{ horaDespierto: string; horaVolvio: string; motivo: string; nota: string }[]>([]);
  const [guardandoDiario, setGuardandoDiario] = useState(false);
  const [diarioError, setDiarioError] = useState('');
  const [diarioExito, setDiarioExito] = useState(false);

  // Detección de duplicados
  const [verificando, setVerificando] = useState(false);
  const [conflictoSueno, setConflictoSueno] = useState(false);
  const [conflictoEvacuacion, setConflictoEvacuacion] = useState(false);
  const [conflictoPipi, setConflictoPipi] = useState(false);
  const [confirmandoSobrescritura, setConfirmandoSobrescritura] = useState(false);

  useEffect(() => {
    async function cargarPaciente() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      const rolActual = (userData?.role || user.user_metadata?.role || 'familia') as Rol;
      setRol(rolActual);

      if (rolActual === 'escuela') {
        const { data: acceso } = await supabase
          .from('expediente_accesos')
          .select('puede_ver_medicamentos, puede_ver_timeline')
          .eq('paciente_id', params.id)
          .eq('usuario_id', user.id)
          .eq('estado', 'activo')
          .single();

        setPermisosEscuela({
          puede_ver_medicamentos: acceso?.puede_ver_medicamentos ?? false,
          puede_ver_timeline: acceso?.puede_ver_timeline ?? false,
        });
      }

      const { data } = await supabase
        .from("pacientes").select("*").eq("id", params.id).single();
      if (!data) { router.push("/dashboard"); return; }
      setPaciente(data);
      setApodoInput(data.apodo || "");
      setLoading(false);
    }
    cargarPaciente();
  }, []);

  function calcularEdad(fecha: string) {
    const hoy = new Date();
    const nac = new Date(fecha);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  }

  async function guardarApodo() {
    setGuardandoApodo(true);
    const nuevoApodo = apodoInput.trim() || null;
    const { error } = await supabase
      .from('pacientes')
      .update({ apodo: nuevoApodo })
      .eq('id', params.id);

    if (!error) {
      setPaciente((prev: any) => ({ ...prev, apodo: nuevoApodo }));
      setEditandoApodo(false);
    } else {
      alert('No se pudo guardar el apodo. Intenta de nuevo.');
    }
    setGuardandoApodo(false);
  }

  function abrirDiario() {
    const ayer = sumarDias(hoyISO(), -1);
    setFechaDormir(ayer);
    setHoraDormir('20:40');
    setFechaDespertar(hoyISO());
    setHoraDespertar('06:50');
    setDiarioPipi(false);
    setFechaPipi(hoyISO());
    setDiarioTuvoEvacuacion(false);
    setFechaEvacuacion(ayer);
    setDiarioConsistencia('normal');
    setFotoEvacuacion(null);
    setPreviewEvacuacion(null);
    setNotaSueno('');
    setNotaEvacuacion('');
    setDespertares([]);
    setDiarioError('');
    setDiarioExito(false);
    setConflictoSueno(false);
    setConflictoEvacuacion(false);
    setConfirmandoSobrescritura(false);
    setDiarioAbierto(true);
  }

  function onFotoEvacuacionSeleccionada(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoEvacuacion(file);
    setPreviewEvacuacion(URL.createObjectURL(file));
  }

  function agregarDespertar() {
    setDespertares(prev => [...prev, { horaDespierto: '03:00', horaVolvio: '03:10', motivo: 'sin_causa', nota: '' }]);
  }

  function actualizarDespertar(index: number, campo: 'horaDespierto' | 'horaVolvio' | 'motivo' | 'nota', valor: string) {
    setDespertares(prev => prev.map((d, i) => i === index ? { ...d, [campo]: valor } : d));
  }

  function quitarDespertar(index: number) {
    setDespertares(prev => prev.filter((_, i) => i !== index));
  }

  async function verificarYGuardar() {
    setDiarioError('');
    setVerificando(true);
    const pacienteId = params.id as string;

    // ¿Ya existe un registro de sueño para esa noche?
    const { data: sueñoExistente } = await supabase
      .from('bitacora_registros')
      .select('id')
      .eq('paciente_id', pacienteId)
      .in('tipo', ['sueno_inicio', 'sueno_fin'])
      .eq('noche_fecha', fechaDespertar)
      .is('deleted_at', null);

    // ¿Ya existe una evacuación registrada ese día?
    let evacuacionExistente: any[] = [];
    if (diarioTuvoEvacuacion) {
      const inicioDia = `${fechaEvacuacion}T00:00:00`;
      const finDia = `${sumarDias(fechaEvacuacion, 1)}T00:00:00`;
      const { data } = await supabase
        .from('bitacora_registros')
        .select('id')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'evacuacion')
        .gte('hora_inicio', inicioDia)
        .lt('hora_inicio', finDia)
        .is('deleted_at', null);
      evacuacionExistente = data || [];
    }

    // ¿Ya existe un registro de pipí nocturno para esa fecha?
    const { data: pipiExistente } = await supabase
      .from('bitacora_registros')
      .select('id')
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'pipi_nocturno')
      .eq('noche_fecha', fechaPipi)
      .is('deleted_at', null);

    const hayConflictoSueno = (sueñoExistente || []).length > 0;
    const hayConflictoEvacuacion = evacuacionExistente.length > 0;
    const hayConflictoPipi = (pipiExistente || []).length > 0;
    setVerificando(false);

    if ((hayConflictoSueno || hayConflictoEvacuacion || hayConflictoPipi) && !confirmandoSobrescritura) {
      setConflictoSueno(hayConflictoSueno);
      setConflictoEvacuacion(hayConflictoEvacuacion);
      setConflictoPipi(hayConflictoPipi);
      setConfirmandoSobrescritura(true);
      return;
    }

    await guardarDiario(hayConflictoSueno, hayConflictoEvacuacion, hayConflictoPipi);
  }

  async function guardarDiario(sobrescribirSueno: boolean, sobrescribirEvacuacion: boolean, sobrescribirPipi: boolean) {
    setGuardandoDiario(true);
    setDiarioError('');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setDiarioError('Sesión no válida.'); setGuardandoDiario(false); return; }

    const pacienteId = params.id as string;

    // Si se va a sobrescribir, marcar como borrados lógicamente los registros existentes de esa noche/día
    // (NOM-004/024: nunca DELETE físico, siempre deleted_at)
    const ahoraISO = new Date().toISOString();
    if (sobrescribirSueno) {
      await supabase
        .from('bitacora_registros')
        .update({ deleted_at: ahoraISO })
        .eq('paciente_id', pacienteId)
        .in('tipo', ['sueno_inicio', 'sueno_fin', 'sueno_despertar'])
        .eq('noche_fecha', fechaDespertar)
        .is('deleted_at', null);
    }
    if (sobrescribirEvacuacion && diarioTuvoEvacuacion) {
      const inicioDia = `${fechaEvacuacion}T00:00:00`;
      const finDia = `${sumarDias(fechaEvacuacion, 1)}T00:00:00`;
      await supabase
        .from('bitacora_registros')
        .update({ deleted_at: ahoraISO })
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'evacuacion')
        .gte('hora_inicio', inicioDia)
        .lt('hora_inicio', finDia)
        .is('deleted_at', null);
    }
    if (sobrescribirPipi) {
      await supabase
        .from('bitacora_registros')
        .update({ deleted_at: ahoraISO })
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'pipi_nocturno')
        .eq('noche_fecha', fechaPipi)
        .is('deleted_at', null);
    }

    // 1. Se durmió
    const { error: errInicio } = await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: 'sueno_inicio',
      noche_fecha: fechaDespertar,
      hora_inicio: `${fechaDormir}T${horaDormir}:00`,
      registrado_por: user.id,
    });

    // 2. Despertar final
    const { error: errFin } = await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: 'sueno_fin',
      noche_fecha: fechaDespertar,
      hora_inicio: `${fechaDespertar}T${horaDespertar}:00`,
      registrado_por: user.id,
    });

    // 2b. Pipi nocturno: registro propio, con su propia fecha y nota
    const { error: errPipi } = await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: 'pipi_nocturno',
      noche_fecha: fechaPipi,
      hora_inicio: `${fechaPipi}T12:00:00`,
      pipi_nocturno: diarioPipi,
      nota: notaSueno || null,
      registrado_por: user.id,
    });

    // 2c. Despertares nocturnos: uno por cada entrada agregada, ligados a la misma noche
    let errDespertares: any = null;
    for (const d of despertares) {
      const horaInicioIso = construirFechaHora(fechaDormir, d.horaDespierto, horaDormir);
      const fechaBaseVolvio = horaInicioIso.slice(0, 10);
      const horaFinIso = d.horaVolvio ? construirFechaHora(fechaBaseVolvio, d.horaVolvio, d.horaDespierto) : null;
      const { error } = await supabase.from('bitacora_registros').insert({
        paciente_id: pacienteId,
        tipo: 'sueno_despertar',
        noche_fecha: fechaDespertar,
        hora_inicio: horaInicioIso,
        hora_fin: horaFinIso,
        motivo: d.motivo || null,
        nota: d.nota || null,
        registrado_por: user.id,
      });
      if (error) errDespertares = error;
    }

    // 3. Evacuación (opcional, con foto)
    let errEvac = null;
    if (diarioTuvoEvacuacion) {
      let fotoPath: string | null = null;
      if (fotoEvacuacion) {
        const ext = fotoEvacuacion.name.split('.').pop();
        fotoPath = `${pacienteId}/bitacora/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('documentos')
          .upload(fotoPath, fotoEvacuacion);
        if (uploadError) {
          setDiarioError('El sueño y la evacuación se guardaron, pero la foto no se pudo subir.');
        }
      }

      const res = await supabase.from('bitacora_registros').insert({
        paciente_id: pacienteId,
        tipo: 'evacuacion',
        hora_inicio: `${fechaEvacuacion}T12:00:00`,
        consistencia: diarioConsistencia,
        foto_url: fotoPath,
        nota: notaEvacuacion || null,
        registrado_por: user.id,
      });
      errEvac = res.error;
    }

    if (errInicio || errFin || errPipi || errDespertares || errEvac) {
      setDiarioError('Algo no se guardó correctamente. Revisa e intenta de nuevo.');
      setGuardandoDiario(false);
      return;
    }

    setConfirmandoSobrescritura(false);
    setDiarioExito(true);
    setGuardandoDiario(false);
  }

  if (loading) return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-400">Cargando expediente...</p>
    </main>
  );

  const esFamilia = rol === 'familia';
  const esEscuela = rol === 'escuela';
  const esProfesionalClinico = !esFamilia && !esEscuela; // medico, terapeuta, centro_terapias, admin

  const escuelaVeMedicamentos = esEscuela && permisosEscuela.puede_ver_medicamentos;
  const escuelaVeTimeline = esEscuela && permisosEscuela.puede_ver_timeline;

  const nombreParaEquipo = paciente.apodo || paciente.nombre;
  const puedeVerExpedienteCompleto = esFamilia || esProfesionalClinico;
  const puedeVerTimeline = esFamilia || esProfesionalClinico || escuelaVeTimeline;

  function TarjetaCompacta({ href, emoji, titulo, descripcion }: { href: string; emoji: string; titulo: string; descripcion: string }) {
    return (
      <Link
        href={href}
        className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-6 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer flex flex-col items-center text-center sm:items-start sm:text-left no-underline"
      >
        <p className="text-xl sm:text-2xl mb-1 sm:mb-3">{emoji}</p>
        <h2 className="text-slate-900 font-semibold text-xs sm:text-base leading-tight mb-0 sm:mb-1">{titulo}</h2>
        <p className="hidden sm:block text-slate-500 text-sm">{descripcion}</p>
      </Link>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg bg-[#00C97A] flex items-center justify-center">
            <span className="text-white font-bold text-xs">S</span>
          </div>
          <span className="text-slate-900 font-bold text-lg tracking-tight">
            Syncro<span className="text-[#00C97A]">Medic</span>
          </span>
        </Link>
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-900 text-sm transition-colors">
          ← Regresar
        </Link>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">

        {/* Header unificado: datos, apodo, diagnóstico, alergias y acceso al expediente completo */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-6 shadow-sm">
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-50 flex items-center justify-center text-2xl sm:text-3xl flex-shrink-0">
              👤
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-slate-900 text-xl sm:text-2xl font-semibold">{paciente.nombre}</h1>
                {esFamilia && (
                  <Link
                    href={`/paciente/${params.id}/scouting?modo=editar`}
                    className="text-slate-400 hover:text-[#1A6BFF] text-xs font-medium transition-colors whitespace-nowrap flex-shrink-0"
                  >
                    ✏️ Editar
                  </Link>
                )}
              </div>

              {esFamilia && editandoApodo ? (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <input
                    type="text"
                    autoFocus
                    value={apodoInput}
                    onChange={(e) => setApodoInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') guardarApodo(); if (e.key === 'Escape') { setApodoInput(paciente.apodo || ""); setEditandoApodo(false); } }}
                    placeholder="Cómo le dicen en casa (ej: Sofi)"
                    className="border border-slate-200 rounded-lg px-2.5 py-1 text-sm text-slate-800 focus:outline-none focus:border-[#1A6BFF] transition-colors"
                  />
                  <button onClick={guardarApodo} disabled={guardandoApodo} className="text-[#1A6BFF] text-xs font-semibold disabled:opacity-50">
                    {guardandoApodo ? "Guardando..." : "Guardar"}
                  </button>
                  <button onClick={() => { setApodoInput(paciente.apodo || ""); setEditandoApodo(false); }} className="text-slate-400 text-xs">
                    Cancelar
                  </button>
                </div>
              ) : (
                <p className="text-slate-500 text-sm mt-1 flex items-center gap-2 flex-wrap">
                  {calcularEdad(paciente.fecha_nacimiento)} años · {paciente.sexo || "—"} · Sangre {paciente.tipo_sangre || "no especificada"}
                  {paciente.apodo && (
                    <span className="text-xs bg-blue-50 text-[#1A6BFF] px-2 py-0.5 rounded-full border border-blue-100">
                      "{paciente.apodo}"
                    </span>
                  )}
                  {esFamilia && (
                    <button onClick={() => setEditandoApodo(true)} className="text-slate-400 hover:text-[#1A6BFF] text-xs transition-colors">
                      {paciente.apodo ? "editar cómo le dicen" : "+ agregar cómo le dicen"}
                    </button>
                  )}
                </p>
              )}

              {paciente.diagnosticos_principales?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {paciente.diagnosticos_principales.map((dx: string, i: number) => (
                    <span key={i} className="text-xs bg-blue-50 text-[#1A6BFF] px-2 py-1 rounded-full border border-blue-100">
                      {dx}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {paciente.alergias?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-red-600 text-xs font-semibold mb-2">⚠️ Alergias conocidas</p>
              <div className="flex flex-wrap gap-2">
                {paciente.alergias.map((a: string, i: number) => (
                  <span key={i} className="text-xs bg-red-50 text-red-600 border border-red-100 px-2 py-1 rounded-full">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {puedeVerExpedienteCompleto && (
            <Link
              href={`/paciente/${params.id}/resumen`}
              className="mt-4 flex items-center justify-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-[#1A6BFF] text-sm font-semibold py-2.5 rounded-xl transition-colors no-underline"
            >
              📄 Ver expediente completo →
            </Link>
          )}
        </div>

        {/* Historial / Timeline: lo más relevante, siempre arriba */}
        {puedeVerTimeline && (
          <Link
            href={`/paciente/${params.id}/timeline`}
            className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-4 hover:border-[#1A6BFF] hover:shadow-md transition-all shadow-sm cursor-pointer flex items-center gap-4 no-underline"
          >
            <p className="text-2xl sm:text-3xl flex-shrink-0">⏱️</p>
            <div>
              <h2 className="text-slate-900 font-semibold text-base sm:text-lg mb-0.5">Historial de {nombreParaEquipo}</h2>
              <p className="text-slate-500 text-xs sm:text-sm">Todo el historial cronológico del expediente, en un solo lugar</p>
            </div>
          </Link>
        )}

        {/* Diario combinado: sueño + evacuación + pipi nocturno, en un solo formulario */}
        {esFamilia && (
          <button
            onClick={abrirDiario}
            className="w-full bg-[#00C97A] hover:bg-green-600 text-white rounded-2xl p-4 sm:p-5 mb-6 shadow-sm transition-colors flex items-center justify-center gap-2 font-semibold text-sm sm:text-base"
          >
            📓 Diario de {nombreParaEquipo}
          </button>
        )}

        {/* Grid compacta: 3 columnas en móvil, 2 desde sm+ */}
        <div className="grid grid-cols-3 sm:grid-cols-2 gap-3 sm:gap-4">

          {(esFamilia || esProfesionalClinico) && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/bitacora/sueno`}
              emoji="😴"
              titulo="Diario de sueño"
              descripcion="Horas dormidas, despertares nocturnos e historial de 30 días"
            />
          )}

          {(esFamilia || esProfesionalClinico) && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/bitacora/evacuaciones`}
              emoji="💧"
              titulo="Evacuaciones"
              descripcion="Galería de fotos, consistencia e historial de 30 días"
            />
          )}

          {esFamilia && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/equipo`}
              emoji="🩺"
              titulo={`Equipo de ${nombreParaEquipo}`}
              descripcion="Doctores, terapeutas y escuela vinculados"
            />
          )}

          {esFamilia && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/bitacora-familiar`}
              emoji="📝"
              titulo="Bitácora familiar"
              descripcion="Tu registro libre del día a día"
            />
          )}
          {esProfesionalClinico && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/notas`}
              emoji="📋"
              titulo="Notas clínicas"
              descripcion="Consultas, sesiones y reportes — puedes agregar y firmar"
            />
          )}

          {esProfesionalClinico && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/medicamentos`}
              emoji="💊"
              titulo="Medicamentos"
              descripcion="Medicamentos activos (solo lectura)"
            />
          )}

          {esFamilia && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/medicamentos`}
              emoji="💊"
              titulo="Medicamentos"
              descripcion="Medicamentos activos y quién los indicó"
            />
          )}

          {escuelaVeMedicamentos && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/medicamentos`}
              emoji="💊"
              titulo="Medicamentos"
              descripcion="Medicamentos activos (solo lectura)"
            />
          )}

          {(esFamilia || esProfesionalClinico) && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/documentos`}
              emoji="📁"
              titulo="Documentos"
              descripcion="Estudios, análisis y recetas"
            />
          )}

          {(esFamilia || esEscuela) && (
            <TarjetaCompacta
              href={`/paciente/${params.id}/recomendaciones`}
              emoji="📝"
              titulo="Recomendaciones"
              descripcion="Indicaciones del equipo para el entorno escolar"
            />
          )}

        </div>

        {esEscuela && (
          <p className="text-slate-400 text-xs mt-6 text-center">
            Como escuela, tu acceso está limitado a las recomendaciones para el entorno escolar{(permisosEscuela.puede_ver_medicamentos || permisosEscuela.puede_ver_timeline) ? ', más lo que la familia te haya habilitado.' : '.'}
          </p>
        )}

      </div>

      {/* Modal: Diario combinado */}
      {diarioAbierto && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
            {diarioExito ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-slate-800 text-lg font-bold mb-2">¡Guardado!</h2>
                <p className="text-slate-500 text-sm mb-5">El registro quedó en la bitácora.</p>
                <button
                  onClick={() => setDiarioAbierto(false)}
                  className="w-full bg-[#1A6BFF] hover:bg-blue-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors"
                >
                  Cerrar
                </button>
              </div>
            ) : confirmandoSobrescritura ? (
              <div>
                <div className="text-center mb-5">
                  <div className="text-4xl mb-3">⚠️</div>
                  <h2 className="text-slate-800 text-lg font-bold mb-2">Ya existe un registro</h2>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-800 flex flex-col gap-1.5">
                  {conflictoSueno && <p>😴 Ya hay un registro de sueño para la noche que despierta el {formatFechaCorta(fechaDespertar)}.</p>}
                  {conflictoEvacuacion && <p>💩 Ya hay una evacuación registrada el {formatFechaCorta(fechaEvacuacion)}.</p>}
                  {conflictoPipi && <p>💧 Ya hay un registro de pipí nocturno para el {formatFechaCorta(fechaPipi)}.</p>}
                </div>
                <p className="text-slate-500 text-xs text-center mb-5">¿Quieres sobrescribir lo ya guardado con esta nueva información?</p>
                <div className="flex gap-3">
                  <button onClick={() => setConfirmandoSobrescritura(false)}
                    className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors">
                    Cancelar
                  </button>
                  <button onClick={() => guardarDiario(conflictoSueno, conflictoEvacuacion, conflictoPipi)} disabled={guardandoDiario}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                    {guardandoDiario ? "Guardando..." : "Sobrescribir"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-slate-800 text-lg font-bold mb-1">Diario de {nombreParaEquipo}</h2>
                <p className="text-slate-500 text-xs mb-5">Registra sueño y evacuación de una sola vez</p>

                <div className="flex flex-col gap-4">

                  {/* Registro de sueño: Se durmió + Despertó, envueltos en una sola caja */}
                  <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-4">
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block font-medium">😴 Se durmió</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={fechaDormir} max={hoyISO()} onChange={e => setFechaDormir(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                        <input type="time" value={horaDormir} onChange={e => setHoraDormir(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-500 text-xs mb-1 block font-medium">☀️ Despertó</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input type="date" value={fechaDespertar} max={hoyISO()} onChange={e => setFechaDespertar(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                        <input type="time" value={horaDespertar} onChange={e => setHoraDespertar(e.target.value)}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1">Esta fecha es la que se usa para contar las horas dormidas.</p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-slate-500 text-xs block font-medium">Despertares nocturnos</label>
                        <button type="button" onClick={agregarDespertar} className="text-[#1A6BFF] text-xs font-semibold">+ Agregar</button>
                      </div>
                      {despertares.length === 0 && (
                        <p className="text-slate-400 text-[11px]">Ninguno registrado. Si no agregas ninguno, se asume que durmió toda la noche sin despertar.</p>
                      )}
                      {despertares.map((d, i) => (
                        <div key={i} className="bg-white border border-slate-200 rounded-xl p-3 mb-2 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 text-xs font-semibold">Despertar {i + 1}</span>
                            <button type="button" onClick={() => quitarDespertar(i)} className="text-red-400 text-xs font-semibold">Quitar</button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-slate-400 text-[11px] block mb-0.5">Se despertó</label>
                              <input type="time" value={d.horaDespierto} onChange={e => actualizarDespertar(i, 'horaDespierto', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                            </div>
                            <div>
                              <label className="text-slate-400 text-[11px] block mb-0.5">Volvió a dormir</label>
                              <input type="time" value={d.horaVolvio} onChange={e => actualizarDespertar(i, 'horaVolvio', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                            </div>
                          </div>
                          <select value={d.motivo} onChange={e => actualizarDespertar(i, 'motivo', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-[#1A6BFF]">
                            {MOTIVOS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                          <textarea rows={2} value={d.nota} onChange={e => actualizarDespertar(i, 'nota', e.target.value)}
                            placeholder="Nota (opcional)"
                            className="w-full border border-slate-200 rounded-lg px-2 py-2 text-sm resize-none focus:outline-none focus:border-[#1A6BFF]" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pipi nocturno: fecha propia, independiente de la fecha de Despertó */}
                  <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block font-medium">Fecha del pipi nocturno</label>
                      <input type="date" value={fechaPipi} max={hoyISO()} onChange={e => setFechaPipi(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                    </div>
                    <div>
                      <span className="text-slate-700 text-sm font-medium block mb-2">💧 ¿Hizo pipi en la noche?</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setDiarioPipi(true)}
                          className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${diarioPipi ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                          Sí
                        </button>
                        <button type="button" onClick={() => setDiarioPipi(false)}
                          className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${!diarioPipi ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                          No
                        </button>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1">En caso de no registrar se mostrará como un "No".</p>
                    </div>
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block font-medium">Nota (opcional)</label>
                      <textarea value={notaSueno} onChange={e => setNotaSueno(e.target.value)}
                        placeholder="Algo del sueño o la noche..." rows={2}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  {/* Evacuación: fecha, foto, pregunta, observación y nota — todo siempre visible */}
                  <div className="bg-slate-50 rounded-xl p-4 flex flex-col gap-3">
                    <div>
                      <label className="text-slate-500 text-xs mb-1 block font-medium">Fecha de la evacuación</label>
                      <input type="date" value={fechaEvacuacion} max={hoyISO()} onChange={e => setFechaEvacuacion(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                    </div>

                    <div>
                      <span className="text-slate-700 text-sm font-medium block mb-2">💩 ¿Hizo popo durante el día?</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setDiarioTuvoEvacuacion(true)}
                          className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${diarioTuvoEvacuacion ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                          Sí
                        </button>
                        <button type="button" onClick={() => setDiarioTuvoEvacuacion(false)}
                          className={`py-2.5 rounded-xl border text-sm font-medium transition-colors ${!diarioTuvoEvacuacion ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
                          No
                        </button>
                      </div>
                      <p className="text-slate-400 text-[11px] mt-1">En caso de no registrar se mostrará como un "No".</p>
                    </div>

                    <div>
                      <label className="text-slate-500 text-xs mb-1 block font-medium">Foto (opcional)</label>
                      <div onClick={() => fotoEvacInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#1A6BFF] transition-colors bg-white">
                        {previewEvacuacion ? (
                          <img src={previewEvacuacion} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
                        ) : (
                          <p className="text-slate-400 text-sm">📷 Toca para adjuntar foto</p>
                        )}
                      </div>
                      <input ref={fotoEvacInputRef} type="file" accept=".jpg,.jpeg,.png,.webp"
                        onChange={onFotoEvacuacionSeleccionada} className="hidden" />
                    </div>

                    <div>
                      <label className="text-slate-500 text-xs mb-2 block font-medium">Según tu observación:</label>
                      <div className="grid grid-cols-2 gap-2">
                        {(Object.keys(CONSISTENCIA_LABELS) as Consistencia[]).map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setDiarioConsistencia(c)}
                            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors bg-white ${diarioConsistencia === c ? "border-[#1A6BFF] bg-blue-50 text-[#1A6BFF]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
                          >
                            {CONSISTENCIA_LABELS[c]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-500 text-xs mb-1 block font-medium">Nota (opcional)</label>
                      <textarea value={notaEvacuacion} onChange={e => setNotaEvacuacion(e.target.value)}
                        placeholder="Algo de la evacuación..." rows={2}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF] resize-none" />
                    </div>
                  </div>

                  {diarioError && <p className="text-red-500 text-sm">{diarioError}</p>}

                  <div className="flex gap-3 mt-1">
                    <button onClick={() => setDiarioAbierto(false)}
                      className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-3 rounded-xl hover:bg-slate-50 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={verificarYGuardar} disabled={guardandoDiario || verificando}
                      className="flex-1 bg-[#00C97A] hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-xl transition-colors">
                      {verificando ? "Revisando..." : guardandoDiario ? "Guardando..." : "Guardar todo"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}