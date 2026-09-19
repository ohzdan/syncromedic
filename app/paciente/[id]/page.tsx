"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'
type Consistencia = 'normal' | 'blanda' | 'dura' | 'diarrea'

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

function SeccionExpediente({ titulo, icono, children }: { titulo: string; icono: string; children: React.ReactNode }) {
  return (
    <div className="mb-1">
      <h2 className="text-slate-800 font-semibold text-sm mb-2 flex items-center gap-2 pt-3 border-t border-slate-100">
        <span>{icono}</span> {titulo}
      </h2>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function DatoExpediente({ label, valor, sinBorde }: { label: string; valor: string | null | undefined; sinBorde?: boolean }) {
  return (
    <div className={`py-2 ${!sinBorde ? "border-b border-slate-50" : ""}`}>
      <p className="text-slate-400 text-[11px]">{label}</p>
      <p className="text-slate-700 text-sm mt-0.5">
        {valor || <span className="text-slate-300">Sin información</span>}
      </p>
    </div>
  );
}

/** Fila de acceso dentro del acordeón (Equipo médico, Documentos, Citas médicas...) */
function AccesoAcordeon({ href, label, icono, destacado }: { href: string; label: string; icono: string; destacado?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between py-3 border-b border-slate-50 last:border-b-0 no-underline ${destacado ? "text-[#1A6BFF]" : "text-slate-700"}`}
    >
      <span className="text-sm flex items-center gap-2">
        <span>{icono}</span> {label}
      </span>
      <span className="text-slate-300 text-sm">›</span>
    </Link>
  );
}

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

function fechaHHMMDD(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Si se da una hora de referencia y la hora nueva es "menor" en el reloj,
 * asumimos que cruzó la medianoche y devolvemos la fecha local del día siguiente.
 */
function fechaAjustada(fechaBase: string, horaHHMM_: string, horaReferencia?: string) {
  if (horaReferencia && horaHHMM_ < horaReferencia) {
    const d = new Date(fechaBase + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }
  return fechaBase
}

/**
 * Construye el instante UTC correcto (ISO) a partir de una fecha base y una hora (HH:MM),
 * interpretando esa fecha/hora como hora local del navegador (CDMX, UTC-6).
 * Si se da una hora de referencia y la hora nueva es "menor" en el reloj,
 * asumimos que cruzó la medianoche y sumamos un día.
 */
function construirFechaHora(fechaBase: string, horaHHMM_: string, horaReferencia?: string) {
  const fecha = fechaAjustada(fechaBase, horaHHMM_, horaReferencia)
  return localToUTCISO(fecha, horaHHMM_)
}

/**
 * Convierte una fecha (YYYY-MM-DD) y hora (HH:MM) interpretadas como hora local
 * del navegador al instante UTC correcto en formato ISO. Usar siempre esto
 * (nunca armar el string a mano) al guardar hora_inicio/hora_fin en bitacora_registros.
 */
function localToUTCISO(fechaISO: string, horaHHMM: string) {
  const [h, m] = horaHHMM.split(':').map(Number)
  const d = new Date(fechaISO + 'T00:00:00')
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

/** Límites [inicio, fin) en UTC de un día calendario local (medianoche a medianoche CDMX). */
function limitesDiaLocalUTC(fechaISO: string) {
  const inicio = new Date(fechaISO + 'T00:00:00')
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 1)
  return { inicio: inicio.toISOString(), fin: fin.toISOString() }
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

/** "8h 10m" a partir de dos ISO. Si faltan datos, devuelve null. */
function formatDuracion(inicioISO?: string, finISO?: string) {
  if (!inicioISO || !finISO) return null;
  const ms = new Date(finISO).getTime() - new Date(inicioISO).getTime();
  if (ms <= 0) return null;
  const horas = Math.floor(ms / 3600000);
  const minutos = Math.round((ms % 3600000) / 60000);
  return `${horas}h ${minutos}m`;
}

type ResumenSueno = { texto: string; noche_fecha: string } | null;
type ResumenEvacuacion = { consistencia: Consistencia; fecha: string } | null;

export default function ExpedientePaciente() {
  const [paciente, setPaciente] = useState<any>(null);
  const [rol, setRol] = useState<Rol>('familia');
  const [permisosEscuela, setPermisosEscuela] = useState({ puede_ver_medicamentos: false, puede_ver_timeline: false });
  const [loading, setLoading] = useState(true);
  const [expedienteAbierto, setExpedienteAbierto] = useState(false);
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const fotoEvacInputRef = useRef<HTMLInputElement>(null);

  // Resúmenes en vivo para las tarjetas del expediente
  const [resumenSueno, setResumenSueno] = useState<ResumenSueno>(null);
  const [resumenEvacuacion, setResumenEvacuacion] = useState<ResumenEvacuacion>(null);
  const [medicamentosActivosCount, setMedicamentosActivosCount] = useState<number | null>(null);

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
      setLoading(false);
      cargarResumenes();
    }
    cargarPaciente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Trae los datos "en vivo" para las tarjetas de Sueño, Evacuación y Medicamentos. */
  async function cargarResumenes() {
    const pacienteId = params.id as string;

    // Sueño: última noche con hora_fin registrada
    const { data: ultimoFin } = await supabase
      .from('bitacora_registros')
      .select('noche_fecha, hora_inicio')
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'sueno_fin')
      .is('deleted_at', null)
      .order('hora_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimoFin) {
      const { data: inicioMismaNoche } = await supabase
        .from('bitacora_registros')
        .select('hora_inicio')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'sueno_inicio')
        .eq('noche_fecha', ultimoFin.noche_fecha)
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      const duracion = formatDuracion(inicioMismaNoche?.hora_inicio, ultimoFin.hora_inicio);
      setResumenSueno(duracion ? { texto: duracion, noche_fecha: ultimoFin.noche_fecha } : null);
    }

    // Evacuación: la más reciente
    const { data: ultimaEvac } = await supabase
      .from('bitacora_registros')
      .select('consistencia, hora_inicio')
      .eq('paciente_id', pacienteId)
      .eq('tipo', 'evacuacion')
      .is('deleted_at', null)
      .order('hora_inicio', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaEvac?.consistencia) {
      setResumenEvacuacion({
        consistencia: ultimaEvac.consistencia as Consistencia,
        fecha: fechaHHMMDD(ultimaEvac.hora_inicio),
      });
    }

    // Medicamentos activos: solo el conteo, para la tarjeta
    const { count } = await supabase
      .from('medicamentos_activos')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .eq('activo', true)
      .is('deleted_at', null);

    setMedicamentosActivosCount(count ?? 0);
  }

  async function abrirDiarioParaEditar(nocheFecha: string) {
    const pacienteId = params.id as string;
    const { data } = await supabase
      .from('bitacora_registros')
      .select('id, tipo, hora_inicio, pipi_nocturno, nota')
      .eq('paciente_id', pacienteId)
      .in('tipo', ['sueno_inicio', 'sueno_fin', 'pipi_nocturno'])
      .eq('noche_fecha', nocheFecha)
      .is('deleted_at', null);

    const inicio = (data || []).find(r => r.tipo === 'sueno_inicio');
    const fin = (data || []).find(r => r.tipo === 'sueno_fin');
    const pipi = (data || []).find(r => r.tipo === 'pipi_nocturno');

    setFechaDormir(inicio ? fechaHHMMDD(inicio.hora_inicio) : sumarDias(nocheFecha, -1));
    setHoraDormir(inicio ? horaHHMM(inicio.hora_inicio) : '20:40');
    setFechaDespertar(nocheFecha);
    setHoraDespertar(fin ? horaHHMM(fin.hora_inicio) : '06:50');
    setDiarioPipi(!!pipi?.pipi_nocturno);
    setFechaPipi(pipi ? fechaHHMMDD(pipi.hora_inicio) : nocheFecha);
    setDiarioTuvoEvacuacion(false);
    setFechaEvacuacion(sumarDias(nocheFecha, -1));
    setDiarioConsistencia('normal');
    setFotoEvacuacion(null);
    setPreviewEvacuacion(null);
    setNotaSueno(pipi?.nota || '');
    setNotaEvacuacion('');
    setDespertares([]);
    setDiarioError('');
    setDiarioExito(false);
    setConflictoSueno(false);
    setConflictoEvacuacion(false);
    setConflictoPipi(false);
    setConfirmandoSobrescritura(false);
    setDiarioAbierto(true);
    router.replace(`/paciente/${pacienteId}`);
  }

  useEffect(() => {
    const nocheFecha = searchParams.get('editarSueno');
    if (nocheFecha) { abrirDiarioParaEditar(nocheFecha); return; }
    // El botón (+) del menú inferior navega aquí con ?accion=registrar
    if (searchParams.get('accion') === 'registrar') {
      abrirDiario();
      router.replace(`/paciente/${params.id}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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

    const { data: sueñoExistente } = await supabase
      .from('bitacora_registros')
      .select('id')
      .eq('paciente_id', pacienteId)
      .in('tipo', ['sueno_inicio', 'sueno_fin'])
      .eq('noche_fecha', fechaDespertar)
      .is('deleted_at', null);

    let evacuacionExistente: any[] = [];
    if (diarioTuvoEvacuacion) {
      const { inicio: inicioDia, fin: finDia } = limitesDiaLocalUTC(fechaEvacuacion);
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
      const { inicio: inicioDia, fin: finDia } = limitesDiaLocalUTC(fechaEvacuacion);
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

    const { error: errInicio } = await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: 'sueno_inicio',
      noche_fecha: fechaDespertar,
      hora_inicio: localToUTCISO(fechaDormir, horaDormir),
      registrado_por: user.id,
    });

    const { error: errFin } = await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: 'sueno_fin',
      noche_fecha: fechaDespertar,
      hora_inicio: localToUTCISO(fechaDespertar, horaDespertar),
      registrado_por: user.id,
    });

    const { error: errPipi } = await supabase.from('bitacora_registros').insert({
      paciente_id: pacienteId,
      tipo: 'pipi_nocturno',
      noche_fecha: fechaPipi,
      hora_inicio: localToUTCISO(fechaPipi, '12:00'),
      pipi_nocturno: diarioPipi,
      nota: notaSueno || null,
      registrado_por: user.id,
    });

    let errDespertares: any = null;
    for (const d of despertares) {
      const horaInicioIso = construirFechaHora(fechaDormir, d.horaDespierto, horaDormir);
      const fechaBaseVolvio = fechaAjustada(fechaDormir, d.horaDespierto, horaDormir);
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
        hora_inicio: localToUTCISO(fechaEvacuacion, '12:00'),
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
    cargarResumenes();
  }

  if (loading) return (
    <main className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-slate-400">Cargando expediente...</p>
    </main>
  );

  const esFamilia = rol === 'familia';
  const esEscuela = rol === 'escuela';
  const esProfesionalClinico = !esFamilia && !esEscuela;

  const escuelaVeMedicamentos = esEscuela && permisosEscuela.puede_ver_medicamentos;
  const escuelaVeTimeline = esEscuela && permisosEscuela.puede_ver_timeline;

  const nombreParaEquipo = paciente.apodo || paciente.nombre;
  const puedeVerExpedienteCompleto = esFamilia || esProfesionalClinico;
  const puedeVerTimeline = esFamilia || esProfesionalClinico || escuelaVeTimeline;

  const iniciales = (paciente.apodo || paciente.nombre || "")
    .split(" ")
    .map((p: string) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* Header: avatar + nombre */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[#00C97A] text-[11px] font-semibold tracking-wide uppercase mb-0.5">Expediente</p>
            <h1 className="text-slate-900 text-xl font-semibold">{nombreParaEquipo}</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              {calcularEdad(paciente.fecha_nacimiento)} años
              {paciente.diagnosticos_principales?.length > 0 && ` · ${paciente.diagnosticos_principales.join(", ")}`}
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-[#1A6BFF] font-semibold text-sm flex-shrink-0">
            {iniciales || "👤"}
          </div>
        </div>

        {paciente.alergias?.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-3 mb-4">
            <p className="text-red-600 text-xs font-semibold mb-1.5">⚠️ Alergias conocidas</p>
            <div className="flex flex-wrap gap-1.5">
              {paciente.alergias.map((a: string, i: number) => (
                <span key={i} className="text-xs bg-white text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tarjetas: Sueño, Evacuación, Medicamentos */}
        <div className="flex flex-col gap-3 mb-4">

          {(esFamilia || esProfesionalClinico) && (
            <Link href={`/paciente/${params.id}/bitacora/sueno`} className="bg-slate-50 rounded-2xl p-4 no-underline block">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">😴</span>
                <span className="text-slate-800 text-sm font-semibold">Sueño & descanso</span>
              </div>
              {resumenSueno ? (
                <>
                  <p className="text-slate-900 text-2xl font-semibold">{resumenSueno.texto}</p>
                  <p className="text-slate-400 text-xs mt-1">Noche del {formatFechaCorta(sumarDias(resumenSueno.noche_fecha, -1))}</p>
                </>
              ) : (
                <p className="text-slate-300 text-sm">Sin registros todavía</p>
              )}
            </Link>
          )}

          {(esFamilia || esProfesionalClinico) && (
            <Link href={`/paciente/${params.id}/bitacora/evacuaciones`} className="bg-slate-50 rounded-2xl p-4 no-underline block">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💧</span>
                  <span className="text-slate-800 text-sm font-semibold">Evacuación</span>
                </div>
                {resumenEvacuacion && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                    {CONSISTENCIA_LABELS[resumenEvacuacion.consistencia]}
                  </span>
                )}
              </div>
              {resumenEvacuacion ? (
                <p className="text-slate-500 text-xs">{formatFechaCorta(resumenEvacuacion.fecha)}</p>
              ) : (
                <p className="text-slate-300 text-sm">Sin registros todavía</p>
              )}
            </Link>
          )}

          {(esFamilia || esProfesionalClinico || escuelaVeMedicamentos) && (
            <Link href={`/paciente/${params.id}/medicamentos`} className="bg-slate-50 rounded-2xl p-4 no-underline block">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💊</span>
                  <span className="text-slate-800 text-sm font-semibold">Medicamentos</span>
                </div>
                <span className="text-slate-500 text-sm">{medicamentosActivosCount ?? "…"} activo{medicamentosActivosCount === 1 ? "" : "s"}</span>
              </div>
            </Link>
          )}

          {/* Ver expediente completo — acordeón */}
          {puedeVerExpedienteCompleto && (
            <div className="bg-slate-50 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setExpedienteAbierto(!expedienteAbierto)}
                className="w-full flex items-center justify-between p-4"
              >
                <span className="text-slate-800 text-sm font-semibold">Ver expediente completo</span>
                <span className={`text-slate-400 inline-block transition-transform ${expedienteAbierto ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {expedienteAbierto && (
                <div className="px-4 pb-4">
                  {esFamilia && (
                    <div className="flex justify-end mb-1">
                      <Link href={`/paciente/${params.id}/scouting?modo=editar`} className="text-[#1A6BFF] text-xs font-medium">
                        ✏️ Editar
                      </Link>
                    </div>
                  )}

                  <SeccionExpediente titulo="Datos generales" icono="👤">
                    <DatoExpediente label="Diagnósticos" valor={paciente.diagnosticos_principales?.join(", ")} />
                    <DatoExpediente label="Alergias" valor={paciente.alergias?.join(", ")} />
                    <DatoExpediente label="Tipo de sangre" valor={paciente.tipo_sangre} />
                    <DatoExpediente label="Lateralidad" valor={paciente.lateralidad} sinBorde />
                  </SeccionExpediente>

                  <SeccionExpediente titulo="Embarazo y nacimiento" icono="🤰">
                    <DatoExpediente label="Embarazo de alto riesgo" valor={paciente.embarazo_alto_riesgo} />
                    <DatoExpediente
                      label="Complicaciones del embarazo"
                      valor={[
                        paciente.complicaciones_embarazo && `Complicaciones: ${paciente.complicaciones_embarazo}`,
                        paciente.diabetes_gestacional && `Diabetes gestacional: ${paciente.diabetes_gestacional}`,
                      ].filter(Boolean).join(" · ") || null}
                    />
                    <DatoExpediente label="Semanas de gestación" valor={paciente.semanas_gestacion?.toString()} />
                    <DatoExpediente label="Tipo de parto" valor={paciente.tipo_parto} />
                    <DatoExpediente
                      label="Complicaciones al nacer"
                      valor={[
                        paciente.complicaciones_nacimiento && `Complicaciones: ${paciente.complicaciones_nacimiento}`,
                        paciente.peso_nacer && `Peso: ${paciente.peso_nacer}`,
                      ].filter(Boolean).join(" · ") || null}
                    />
                    <DatoExpediente
                      label="UCIN y APGAR"
                      valor={[
                        paciente.requirio_ucin && `UCIN: ${paciente.requirio_ucin}`,
                        paciente.apgar && `APGAR: ${paciente.apgar}`,
                      ].filter(Boolean).join(" · ") || null}
                    />
                    <DatoExpediente
                      label="Tamices neonatales"
                      valor={[paciente.tamiz_metabolico, paciente.tamiz_auditivo, paciente.tamiz_cardiaco].filter(Boolean).join(" · ") || null}
                      sinBorde
                    />
                  </SeccionExpediente>

                  <SeccionExpediente titulo="Desarrollo" icono="📈">
                    <DatoExpediente
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
                    <DatoExpediente
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
                    <DatoExpediente label="Terapias actuales" valor={paciente.terapias_actuales?.join(", ")} sinBorde />
                  </SeccionExpediente>

                  <SeccionExpediente titulo="Antecedentes y condiciones" icono="📋">
                    <DatoExpediente label="Antecedentes familiares" valor={formatAntecedentesFamiliares(paciente.antecedentes_familiares_detalle)} />
                    <DatoExpediente
                      label="Historial médico"
                      valor={[paciente.cirugias_previas, paciente.hospitalizaciones_previas].filter(Boolean).join(" · ") || null}
                    />
                    <DatoExpediente label="Condiciones crónicas" valor={paciente.condiciones_cronicas?.join(", ")} sinBorde />
                  </SeccionExpediente>

                  <SeccionExpediente titulo="Vacunas" icono="💉">
                    <DatoExpediente
                      label="Vacunas registradas"
                      valor={paciente.vacunas?.lista?.length ? paciente.vacunas.lista.join(", ") : null}
                    />
                    <DatoExpediente label="Otras vacunas" valor={paciente.vacunas_otras} sinBorde />
                  </SeccionExpediente>

                  <SeccionExpediente titulo="Rutinas diarias" icono="🌙">
                    <DatoExpediente
                      label="Sueño"
                      valor={paciente.sueno_hora_dormir ? `Duerme ${paciente.sueno_hora_dormir} · Despierta ${paciente.sueno_hora_despertar}${paciente.sueno_colecho ? ` · Colecho: ${paciente.sueno_colecho}` : ""}` : null}
                    />
                    <DatoExpediente label="Alimentación" valor={paciente.alimentacion_notas} sinBorde />
                  </SeccionExpediente>

                  <SeccionExpediente titulo="Entorno familiar" icono="🏠">
                    <DatoExpediente label="Con quién vive" valor={paciente.con_quien_vive} />
                    <DatoExpediente label="Hermanos" valor={paciente.hermanos} />
                    <DatoExpediente label="Escuela" valor={paciente.escuela_regular} sinBorde />
                  </SeccionExpediente>

                  <SeccionExpediente titulo="Contacto de emergencia" icono="🚨">
                    <DatoExpediente label="Nombre" valor={paciente.contacto_emergencia?.nombre} />
                    <DatoExpediente
                      label="Teléfono y parentesco"
                      valor={[paciente.contacto_emergencia?.telefono, paciente.contacto_emergencia?.parentesco].filter(Boolean).join(" · ") || null}
                    />
                    <DatoExpediente label="Hospital de preferencia" valor={paciente.hospital_preferencia} />
                    <DatoExpediente label="Médico de cabecera" valor={paciente.medico_cabecera} />
                    <DatoExpediente
                      label="Seguro médico"
                      valor={paciente.seguro_medico === "Sí" ? `Sí${paciente.aseguradora ? ` — ${paciente.aseguradora}` : ""}` : paciente.seguro_medico}
                      sinBorde
                    />
                  </SeccionExpediente>

                  {/* Accesos que se quedaron fuera del menú principal por ser de uso poco frecuente */}
                  <div className="pt-3 border-t border-slate-100 mt-1">
                    {esFamilia && (
                      <AccesoAcordeon href={`/paciente/${params.id}/equipo`} icono="🩺" label={`Equipo de ${nombreParaEquipo}`} destacado />
                    )}
                    {(esFamilia || esProfesionalClinico) && (
                      <AccesoAcordeon href={`/paciente/${params.id}/documentos`} icono="📁" label="Documentos" destacado />
                    )}
                    {esFamilia && (
                      <AccesoAcordeon href={`/paciente/${params.id}/citas`} icono="📅" label="Citas médicas" destacado />
                    )}
                    {esFamilia && (
                      <AccesoAcordeon href={`/paciente/${params.id}/bitacora-familiar`} icono="📝" label="Bitácora familiar" />
                    )}
                    {esProfesionalClinico && (
                      <AccesoAcordeon href={`/paciente/${params.id}/notas`} icono="📋" label="Notas clínicas" />
                    )}
                    {(esFamilia || esEscuela) && (
                      <AccesoAcordeon href={`/paciente/${params.id}/recomendaciones`} icono="📝" label="Recomendaciones" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historial: siempre visible como acceso destacado, aunque también vive en el menú inferior */}
          {puedeVerTimeline && (
            <Link
              href={`/paciente/${params.id}/timeline`}
              className="bg-slate-50 rounded-2xl p-4 no-underline flex items-center gap-3"
            >
              <span className="text-lg">⏱️</span>
              <div>
                <p className="text-slate-800 text-sm font-semibold">Historial de {nombreParaEquipo}</p>
                <p className="text-slate-400 text-xs">Todo el historial, en un solo lugar</p>
              </div>
            </Link>
          )}
        </div>

        {esEscuela && (
          <p className="text-slate-400 text-xs mt-4 text-center">
            Como escuela, tu acceso está limitado a las recomendaciones para el entorno escolar{(permisosEscuela.puede_ver_medicamentos || permisosEscuela.puede_ver_timeline) ? ', más lo que la familia te haya habilitado.' : '.'}
          </p>
        )}
      </div>

      {/* Modal: Diario combinado (idéntico al original, sin cambios de lógica) */}
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

      {(esFamilia || esProfesionalClinico || esEscuela) && (
        <BottomNav pacienteId={params.id as string} activo="inicio" />
      )}
    </main>
  );
}

function calcularEdad(fecha: string) {
  const hoy = new Date();
  const nac = new Date(fecha);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}