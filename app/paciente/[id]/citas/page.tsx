"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";

type EstadoCita = 'proxima' | 'realizada' | 'cancelada';

type Cita = {
  id: string;
  medico_id: string | null;
  medico_nombre_texto: string | null;
  fecha: string;
  hora: string | null;
  estado: EstadoCita;
};

type MiembroEquipo = {
  usuario_id: string;
  nombre: string;
  especialidad: string | null;
};

function formatFechaLarga(fechaISO: string) {
  return new Date(fechaISO + 'T12:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}

function hoyISO() {
  return new Date().toISOString().split('T')[0];
}

export default function CitasMedicas() {
  const [rol, setRol] = useState<string | null>(null);
  const [nombreParaEquipo, setNombreParaEquipo] = useState("");
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);

  const [formAbierto, setFormAbierto] = useState(false);
  const [medicoSeleccionado, setMedicoSeleccionado] = useState<string>(""); // usuario_id o "otro"
  const [nombreLibre, setNombreLibre] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState("10:00");
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const pacienteId = params.id as string;

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/"); return; }

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    setRol(userData?.role ?? null);

    const { data: paciente } = await supabase
      .from('pacientes')
      .select('nombre, apodo')
      .eq('id', pacienteId)
      .single();
    if (!paciente) { router.push('/dashboard'); return; }
    setNombreParaEquipo(paciente.apodo || paciente.nombre);

    const { data: accesos } = await supabase
      .from('expediente_accesos')
      .select('usuario_id, users(full_name, especialidad)')
      .eq('paciente_id', pacienteId)
      .eq('estado', 'activo');

    setEquipo(
      (accesos || []).map((a: any) => ({
        usuario_id: a.usuario_id,
        nombre: a.users?.full_name || 'Sin nombre',
        especialidad: a.users?.especialidad || null,
      }))
    );

    const { data: citasData } = await supabase
      .from('citas_medicas')
      .select('id, medico_id, medico_nombre_texto, fecha, hora, estado')
      .eq('paciente_id', pacienteId)
      .is('deleted_at', null)
      .order('fecha', { ascending: true });

    setCitas((citasData || []) as Cita[]);
    setCargando(false);
  }

  function nombreDeCita(cita: Cita) {
    if (cita.medico_nombre_texto) return cita.medico_nombre_texto;
    const m = equipo.find(e => e.usuario_id === cita.medico_id);
    return m ? `${m.nombre}${m.especialidad ? ` · ${m.especialidad}` : ''}` : 'Especialista';
  }

  async function agendarCita() {
    setErrorForm("");
    const esOtro = medicoSeleccionado === "otro";
    if (!esOtro && !medicoSeleccionado) { setErrorForm("Elige un médico o escribe el nombre."); return; }
    if (esOtro && !nombreLibre.trim()) { setErrorForm("Escribe el nombre del médico."); return; }
    if (!fecha) { setErrorForm("Elige una fecha."); return; }

    setGuardando(true);
    const { data, error } = await supabase.from('citas_medicas').insert({
      paciente_id: pacienteId,
      medico_id: esOtro ? null : medicoSeleccionado,
      medico_nombre_texto: esOtro ? nombreLibre.trim() : null,
      fecha,
      hora,
      estado: 'proxima',
    }).select().single();

    if (error || !data) {
      setErrorForm("No se pudo agendar la cita. Intenta de nuevo.");
      setGuardando(false);
      return;
    }

    setCitas(prev => [...prev, data as Cita].sort((a, b) => a.fecha.localeCompare(b.fecha)));
    setFormAbierto(false);
    setMedicoSeleccionado("");
    setNombreLibre("");
    setFecha(hoyISO());
    setHora("10:00");
    setGuardando(false);
  }

  async function cambiarEstado(cita: Cita, nuevoEstado: EstadoCita) {
    const { error } = await supabase.from('citas_medicas').update({ estado: nuevoEstado }).eq('id', cita.id);
    if (!error) {
      setCitas(prev => prev.map(c => c.id === cita.id ? { ...c, estado: nuevoEstado } : c));
    }
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  const esFamilia = rol === 'familia';
  const proximas = citas.filter(c => c.estado === 'proxima').sort((a, b) => a.fecha.localeCompare(b.fecha));
  const pasadas = citas.filter(c => c.estado !== 'proxima').sort((a, b) => b.fecha.localeCompare(a.fecha));

  return (
    <main className="min-h-screen bg-white pb-10">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <button onClick={() => router.back()} className="text-slate-400 text-sm mb-3">← Regresar</button>
        <h1 className="text-slate-900 text-xl font-semibold mb-1">Citas médicas</h1>
        <p className="text-slate-400 text-sm mb-6">{nombreParaEquipo}</p>

        <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Próximas</p>
        {proximas.length === 0 ? (
          <p className="text-slate-300 text-sm mb-6">Sin citas próximas</p>
        ) : (
          <div className="flex flex-col gap-2 mb-6">
            {proximas.map(cita => (
              <div key={cita.id} className="bg-blue-50 rounded-2xl p-4">
                <p className="text-[#0C447C] text-sm font-semibold">{nombreDeCita(cita)}</p>
                <p className="text-[#185fa5] text-xs mt-0.5">
                  {formatFechaLarga(cita.fecha)}{cita.hora ? ` · ${cita.hora.slice(0, 5)}` : ''}
                </p>
                {esFamilia && (
                  <div className="flex gap-3 mt-2.5">
                    <button onClick={() => cambiarEstado(cita, 'realizada')} className="text-[#1A6BFF] text-xs font-semibold">
                      Marcar como realizada
                    </button>
                    <button onClick={() => cambiarEstado(cita, 'cancelada')} className="text-red-400 text-xs font-semibold">
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-slate-400 text-xs uppercase tracking-wide mb-2">Pasadas</p>
        {pasadas.length === 0 ? (
          <p className="text-slate-300 text-sm mb-6">Sin citas registradas todavía</p>
        ) : (
          <div className="flex flex-col gap-2 mb-6">
            {pasadas.map(cita => (
              <div key={cita.id} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-slate-800 text-sm font-medium">{nombreDeCita(cita)}</p>
                  <p className="text-slate-400 text-xs mt-0.5">{formatFechaLarga(cita.fecha)}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 ${cita.estado === 'realizada' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-500'}`}>
                  {cita.estado === 'realizada' ? 'Realizada' : 'Cancelada'}
                </span>
              </div>
            ))}
          </div>
        )}

        {esFamilia && (
          !formAbierto ? (
            <button
              onClick={() => setFormAbierto(true)}
              className="w-full border border-dashed border-blue-200 bg-blue-50/40 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 text-[#1A6BFF] text-sm font-medium"
            >
              <span className="text-lg">➕</span> Agendar cita
            </button>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4">
              <p className="text-slate-400 text-[11px] uppercase tracking-wide mb-3">Nueva cita</p>

              <label className="text-slate-500 text-xs block mb-1.5">Médico o especialista</label>
              <select
                value={medicoSeleccionado}
                onChange={e => setMedicoSeleccionado(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm mb-3 focus:outline-none focus:border-[#1A6BFF]"
              >
                <option value="">Selecciona...</option>
                {equipo.map(m => (
                  <option key={m.usuario_id} value={m.usuario_id}>
                    {m.nombre}{m.especialidad ? ` · ${m.especialidad}` : ''}
                  </option>
                ))}
                <option value="otro">Otro (escribir nombre)</option>
              </select>

              {medicoSeleccionado === "otro" && (
                <input
                  type="text"
                  value={nombreLibre}
                  onChange={e => setNombreLibre(e.target.value)}
                  placeholder="Nombre del médico"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm mb-3 focus:outline-none focus:border-[#1A6BFF]"
                />
              )}

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-slate-500 text-xs block mb-1.5">Fecha</label>
                  <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
                <div>
                  <label className="text-slate-500 text-xs block mb-1.5">Hora</label>
                  <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm focus:outline-none focus:border-[#1A6BFF]" />
                </div>
              </div>

              {errorForm && <p className="text-red-500 text-xs mb-3">{errorForm}</p>}

              <div className="flex gap-3">
                <button
                  onClick={() => { setFormAbierto(false); setErrorForm(""); }}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  onClick={agendarCita}
                  disabled={guardando}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl"
                >
                  {guardando ? "Guardando..." : "Agendar"}
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </main>
  );
}