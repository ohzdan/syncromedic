"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

type TipoPublicacion = 'consulta' | 'medicamento_nuevo' | 'terapia' | 'estudio' | 'anomalia_bitacora' | 'otro';
type TipoReaccion = 'revisado' | 'confirmado' | 'requiere_ajuste' | 'prioritario' | 'corazon';

type Publicacion = {
  id: string;
  autor_id: string;
  tipo: TipoPublicacion;
  medico_etiquetado_id: string | null;
  diagnostico: string | null;
  tratamiento: string | null;
  proxima_cita_o_alarma: string | null;
  exploracion: string | null;
  estudios_solicitados: string | null;
  nota_abierta: string | null;
  fecha: string;
  created_at: string;
};

type Comentario = {
  id: string;
  autor_id: string;
  autor_nombre: string;
  contenido: string;
  created_at: string;
};

type EventoInformativo = {
  id: string;
  tipo: 'documento' | 'especialista';
  titulo: string;
  descripcion: string;
  fecha: string;
};

const LABELS_PUBLICACION: Record<TipoPublicacion, string> = {
  consulta: 'Consulta',
  medicamento_nuevo: 'Medicamento nuevo',
  terapia: 'Sesión de terapia',
  estudio: 'Estudio',
  anomalia_bitacora: 'Aviso de bitácora',
  otro: 'Actualización',
};

const ICONOS_PUBLICACION: Record<TipoPublicacion, string> = {
  consulta: '🩺',
  medicamento_nuevo: '💊',
  terapia: '🧩',
  estudio: '🧪',
  anomalia_bitacora: '⚠️',
  otro: '📌',
};

const REACCIONES: { tipo: TipoReaccion; label: string; icono: string }[] = [
  { tipo: 'revisado', label: 'Revisado', icono: '👁️' },
  { tipo: 'confirmado', label: 'Confirmado', icono: '✅' },
  { tipo: 'requiere_ajuste', label: 'Requiere ajuste', icono: '⚠️' },
  { tipo: 'prioritario', label: 'Prioritario', icono: '🚩' },
];

function formatFecha(fecha: string) {
  return new Date(fecha + (fecha.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

function hoyISO() { return new Date().toISOString().split('T')[0]; }

export default function HistorialMuro() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const pacienteId = params.id as string;

  const [nombreParaEquipo, setNombreParaEquipo] = useState("");
  const [rol, setRol] = useState<string>('familia');
  const [userId, setUserId] = useState<string>("");
  const [cargando, setCargando] = useState(true);

  const [publicaciones, setPublicaciones] = useState<Publicacion[]>([]);
  const [reacciones, setReacciones] = useState<Record<string, { tipo: TipoReaccion; usuario_id: string }[]>>({});
  const [comentarios, setComentarios] = useState<Record<string, Comentario[]>>({});
  const [informativos, setInformativos] = useState<EventoInformativo[]>([]);
  const [equipo, setEquipo] = useState<any[]>([]);

  const [expandido, setExpandido] = useState<string | null>(null);
  const [nuevoComentario, setNuevoComentario] = useState<Record<string, string>>({});

  const [filtro, setFiltro] = useState<'todos' | TipoPublicacion>('todos');

  const [formAbierto, setFormAbierto] = useState(false);
  const [medicoEtiquetado, setMedicoEtiquetado] = useState("");
  const [fecha, setFecha] = useState(hoyISO());
  const [diagnostico, setDiagnostico] = useState("");
  const [tratamiento, setTratamiento] = useState("");
  const [proximaCita, setProximaCita] = useState("");
  const [exploracion, setExploracion] = useState("");
  const [estudios, setEstudios] = useState("");
  const [notaAbierta, setNotaAbierta] = useState("");
  const [guardandoConsulta, setGuardandoConsulta] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState("");

  useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function cargar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }
    setUserId(user.id);

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single();
    setRol(userData?.role || user.user_metadata?.role || 'familia');

    const { data: pac } = await supabase.from('pacientes').select('nombre, apodo').eq('id', pacienteId).single();
    if (!pac) { router.push('/dashboard'); return; }
    setNombreParaEquipo(pac.apodo || pac.nombre);

    const { data: accesos } = await supabase
      .from('expediente_accesos')
      .select('usuario_id, created_at, users(full_name, role, especialidad)')
      .eq('paciente_id', pacienteId)
      .eq('estado', 'activo');

    setEquipo((accesos || []).map((a: any) => ({ id: a.usuario_id, nombre: a.users?.full_name, especialidad: a.users?.especialidad })));

    const informativosTemp: EventoInformativo[] = (accesos || []).map((a: any) => ({
      id: 'esp-' + a.usuario_id,
      tipo: 'especialista',
      titulo: a.users?.full_name || 'Profesional',
      descripcion: `Se unió al equipo · ${a.users?.especialidad || a.users?.role || ''}`,
      fecha: a.created_at,
    }));

    const { data: docs } = await supabase
      .from('documentos')
      .select('id, nombre, categoria, created_at')
      .eq('paciente_id', pacienteId)
      .is('deleted_at', null);

    for (const d of docs || []) {
      informativosTemp.push({ id: 'doc-' + d.id, tipo: 'documento', titulo: d.nombre || 'Documento', descripcion: d.categoria || 'Documento subido', fecha: d.created_at });
    }
    setInformativos(informativosTemp);

    const { data: pubs } = await supabase
      .from('publicaciones')
      .select('id, autor_id, tipo, medico_etiquetado_id, diagnostico, tratamiento, proxima_cita_o_alarma, exploracion, estudios_solicitados, nota_abierta, fecha, created_at')
      .eq('paciente_id', pacienteId)
      .is('deleted_at', null)
      .order('fecha', { ascending: false });

    const listaPubs = (pubs || []) as Publicacion[];
    setPublicaciones(listaPubs);

    if (listaPubs.length > 0) {
      const ids = listaPubs.map(p => p.id);

      const { data: reaccionesData } = await supabase
        .from('reacciones_publicacion')
        .select('publicacion_id, usuario_id, tipo')
        .in('publicacion_id', ids);

      const mapaReacciones: Record<string, { tipo: TipoReaccion; usuario_id: string }[]> = {};
      for (const r of reaccionesData || []) {
        if (!mapaReacciones[r.publicacion_id]) mapaReacciones[r.publicacion_id] = [];
        mapaReacciones[r.publicacion_id].push({ tipo: r.tipo, usuario_id: r.usuario_id });
      }
      setReacciones(mapaReacciones);

      const { data: comentariosData } = await supabase
        .from('comentarios_publicacion')
        .select('id, publicacion_id, autor_id, contenido, created_at, users(full_name)')
        .in('publicacion_id', ids)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      const mapaComentarios: Record<string, Comentario[]> = {};
      for (const c of (comentariosData || []) as any[]) {
        if (!mapaComentarios[c.publicacion_id]) mapaComentarios[c.publicacion_id] = [];
        mapaComentarios[c.publicacion_id].push({
          id: c.id, autor_id: c.autor_id, autor_nombre: c.users?.full_name || 'Familia', contenido: c.contenido, created_at: c.created_at,
        });
      }
      setComentarios(mapaComentarios);
    }

    setCargando(false);
  }

  async function alternarReaccion(publicacionId: string, tipo: TipoReaccion) {
    const propia = (reacciones[publicacionId] || []).find(r => r.usuario_id === userId);

    if (propia?.tipo === tipo) {
      await supabase.from('reacciones_publicacion').delete().eq('publicacion_id', publicacionId).eq('usuario_id', userId);
      setReacciones(prev => ({ ...prev, [publicacionId]: (prev[publicacionId] || []).filter(r => r.usuario_id !== userId) }));
      return;
    }

    await supabase.from('reacciones_publicacion').upsert(
      { publicacion_id: publicacionId, usuario_id: userId, tipo },
      { onConflict: 'publicacion_id,usuario_id' }
    );

    setReacciones(prev => ({
      ...prev,
      [publicacionId]: [...(prev[publicacionId] || []).filter(r => r.usuario_id !== userId), { tipo, usuario_id: userId }],
    }));
  }

  async function enviarComentario(publicacionId: string) {
    const contenido = (nuevoComentario[publicacionId] || "").trim();
    if (!contenido) return;

    const { data, error } = await supabase
      .from('comentarios_publicacion')
      .insert({ publicacion_id: publicacionId, autor_id: userId, contenido })
      .select('id, autor_id, contenido, created_at, users(full_name)')
      .single();

    if (!error && data) {
      const nuevo: Comentario = {
        id: data.id, autor_id: data.autor_id, autor_nombre: (data as any).users?.full_name || 'Tú', contenido: data.contenido, created_at: data.created_at,
      };
      setComentarios(prev => ({ ...prev, [publicacionId]: [...(prev[publicacionId] || []), nuevo] }));
      setNuevoComentario(prev => ({ ...prev, [publicacionId]: "" }));
    }
  }

  async function registrarConsulta() {
    setErrorConsulta("");
    if (!diagnostico.trim() || !tratamiento.trim() || !proximaCita.trim()) {
      setErrorConsulta("Los 3 campos esenciales son obligatorios.");
      return;
    }
    setGuardandoConsulta(true);

    const { data, error } = await supabase.from('publicaciones').insert({
      paciente_id: pacienteId,
      autor_id: userId,
      tipo: 'consulta',
      medico_etiquetado_id: medicoEtiquetado || null,
      diagnostico: diagnostico.trim(),
      tratamiento: tratamiento.trim(),
      proxima_cita_o_alarma: proximaCita.trim(),
      exploracion: exploracion.trim() || null,
      estudios_solicitados: estudios.trim() || null,
      nota_abierta: notaAbierta.trim() || null,
      fecha,
    }).select().single();

    if (error || !data) {
      setErrorConsulta("No se pudo guardar. Intenta de nuevo.");
      setGuardandoConsulta(false);
      return;
    }

    setPublicaciones(prev => [data as Publicacion, ...prev]);
    setFormAbierto(false);
    setMedicoEtiquetado(""); setDiagnostico(""); setTratamiento(""); setProximaCita("");
    setExploracion(""); setEstudios(""); setNotaAbierta(""); setFecha(hoyISO());
    setGuardandoConsulta(false);
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando...</p>
      </main>
    );
  }

  const esFamilia = rol === 'familia';

  // Combina publicaciones + eventos informativos en un solo feed cronológico
  type ItemFeed = { fecha: string; publicacion?: Publicacion; informativo?: EventoInformativo };
  let feed: ItemFeed[] = [
    ...publicaciones.map(p => ({ fecha: p.fecha, publicacion: p })),
    ...(filtro === 'todos' ? informativos.map(i => ({ fecha: i.fecha, informativo: i })) : []),
  ];
  if (filtro !== 'todos') feed = feed.filter(f => f.publicacion?.tipo === filtro);
  feed.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const stats = {
    consultas: publicaciones.filter(p => p.tipo === 'consulta').length,
    medicamentos: publicaciones.filter(p => p.tipo === 'medicamento_nuevo').length,
    documentos: informativos.filter(i => i.tipo === 'documento').length,
    especialistas: informativos.filter(i => i.tipo === 'especialista').length,
  };

  return (
    <main className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <p className="text-[#00C97A] text-[11px] font-semibold tracking-wide uppercase mb-0.5">Historial</p>
        <h1 className="text-slate-900 text-xl font-semibold mb-4">{nombreParaEquipo}</h1>

        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Consultas', value: stats.consultas },
            { label: 'Medicam.', value: stats.medicamentos },
            { label: 'Docs.', value: stats.documentos },
            { label: 'Especial.', value: stats.especialistas },
          ].map(s => (
            <div key={s.label} className="bg-slate-50 rounded-xl text-center py-2.5">
              <p className="text-slate-900 text-base font-semibold">{s.value}</p>
              <p className="text-slate-400 text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto mb-5 pb-1">
          {([
            { value: 'todos', label: 'Todos' },
            { value: 'consulta', label: '🩺 Consulta' },
            { value: 'medicamento_nuevo', label: '💊 Medicamento' },
            { value: 'terapia', label: '🧩 Terapia' },
            { value: 'estudio', label: '🧪 Estudio' },
          ] as { value: 'todos' | TipoPublicacion; label: string }[]).map(f => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`flex-shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium ${filtro === f.value ? "bg-[#1A6BFF] text-white" : "bg-slate-50 text-slate-500"}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {esFamilia && (
          !formAbierto ? (
            <button
              onClick={() => setFormAbierto(true)}
              className="w-full border border-dashed border-blue-200 bg-blue-50/40 rounded-2xl p-3.5 flex items-center justify-center gap-2.5 text-[#1A6BFF] text-sm font-medium mb-5"
            >
              <span className="text-lg">🩺</span> Registrar consulta
            </button>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4 mb-5">
              <p className="text-slate-400 text-[11px] uppercase tracking-wide mb-3">Registrar consulta</p>

              <label className="text-slate-500 text-xs block mb-1.5">Médico o especialista (opcional, le llega notificación)</label>
              <select value={medicoEtiquetado} onChange={e => setMedicoEtiquetado(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm mb-3 focus:outline-none focus:border-[#1A6BFF]">
                <option value="">Sin etiquetar</option>
                {equipo.map(m => <option key={m.id} value={m.id}>{m.nombre}{m.especialidad ? ` · ${m.especialidad}` : ''}</option>)}
              </select>

              <label className="text-slate-500 text-xs block mb-1.5">Fecha</label>
              <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 text-sm mb-4 focus:outline-none focus:border-[#1A6BFF]" />

              <p className="text-[#1A6BFF] text-[10px] font-semibold uppercase tracking-wide mb-2">Lo esencial</p>

              <label className="text-slate-500 text-xs block mb-1">Diagnóstico o sospecha *</label>
              <textarea value={diagnostico} onChange={e => setDiagnostico(e.target.value)} rows={2}
                placeholder="¿Qué te dijo el médico?"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm mb-3 resize-none focus:outline-none focus:border-[#1A6BFF]" />

              <label className="text-slate-500 text-xs block mb-1">Tratamiento indicado *</label>
              <textarea value={tratamiento} onChange={e => setTratamiento(e.target.value)} rows={2}
                placeholder="Medicamento, dosis, duración — o 'sin cambios'"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm mb-3 resize-none focus:outline-none focus:border-[#1A6BFF]" />

              <label className="text-slate-500 text-xs block mb-1">Próxima cita / signos de alarma *</label>
              <textarea value={proximaCita} onChange={e => setProximaCita(e.target.value)} rows={2}
                placeholder="Cuándo regresar, o qué vigilar"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm mb-4 resize-none focus:outline-none focus:border-[#1A6BFF]" />

              <p className="text-slate-400 text-[10px] uppercase tracking-wide mb-2">Opcional</p>

              <label className="text-slate-500 text-xs block mb-1">Qué revisó o exploró</label>
              <textarea value={exploracion} onChange={e => setExploracion(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm mb-3 resize-none focus:outline-none focus:border-[#1A6BFF]" />

              <label className="text-slate-500 text-xs block mb-1">Estudios solicitados</label>
              <textarea value={estudios} onChange={e => setEstudios(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm mb-3 resize-none focus:outline-none focus:border-[#1A6BFF]" />

              <label className="text-slate-500 text-xs block mb-1">Nota abierta</label>
              <textarea value={notaAbierta} onChange={e => setNotaAbierta(e.target.value)} rows={2}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 bg-white text-sm mb-3 resize-none focus:outline-none focus:border-[#1A6BFF]" />

              {errorConsulta && <p className="text-red-500 text-xs mb-3">{errorConsulta}</p>}

              <div className="flex gap-3">
                <button onClick={() => setFormAbierto(false)} className="flex-1 border border-slate-200 text-slate-600 text-sm font-medium py-2.5 rounded-xl">Cancelar</button>
                <button onClick={registrarConsulta} disabled={guardandoConsulta}
                  className="flex-1 bg-[#1A6BFF] hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl">
                  {guardandoConsulta ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          )
        )}

        {feed.length === 0 ? (
          <p className="text-slate-300 text-sm text-center py-10">No hay eventos todavía</p>
        ) : (
          <div className="flex flex-col gap-3">
            {feed.map(item => {
              if (item.informativo) {
                const info = item.informativo;
                return (
                  <div key={info.id} className="bg-slate-50 rounded-2xl p-4 opacity-70">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-slate-500">{info.tipo === 'documento' ? '📁' : '👤'} {info.titulo}</span>
                      <span className="text-[10px] text-slate-400">{formatFecha(info.fecha)}</span>
                    </div>
                    <p className="text-slate-400 text-xs">{info.descripcion}</p>
                  </div>
                );
              }

              const pub = item.publicacion!;
              const misReacciones = reacciones[pub.id] || [];
              const miReaccion = misReacciones.find(r => r.usuario_id === userId)?.tipo;
              const conteo: Partial<Record<TipoReaccion, number>> = {};
              for (const r of misReacciones) conteo[r.tipo] = (conteo[r.tipo] || 0) + 1;
              const listaComentarios = comentarios[pub.id] || [];
              const abierto = expandido === pub.id;

              return (
                <div key={pub.id} className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#1A6BFF] flex items-center gap-1.5">
                      {ICONOS_PUBLICACION[pub.tipo]} {LABELS_PUBLICACION[pub.tipo]}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatFecha(pub.fecha)}</span>
                  </div>

                  {pub.diagnostico && <p className="text-slate-800 text-sm mb-1"><span className="text-slate-400">Diagnóstico:</span> {pub.diagnostico}</p>}
                  {pub.tratamiento && <p className="text-slate-800 text-sm mb-1"><span className="text-slate-400">Tratamiento:</span> {pub.tratamiento}</p>}
                  {pub.proxima_cita_o_alarma && <p className="text-slate-600 text-xs mb-1">📅 {pub.proxima_cita_o_alarma}</p>}
                  {pub.exploracion && <p className="text-slate-500 text-xs mb-1">Exploración: {pub.exploracion}</p>}
                  {pub.estudios_solicitados && <p className="text-slate-500 text-xs mb-1">Estudios: {pub.estudios_solicitados}</p>}
                  {pub.nota_abierta && <p className="text-slate-500 text-xs italic mt-1.5">{pub.nota_abierta}</p>}

                  <div className="flex gap-1.5 flex-wrap mt-3 pt-3 border-t border-slate-100">
                    {pub.tipo === 'terapia' ? (
                      <button
                        onClick={() => alternarReaccion(pub.id, 'corazon')}
                        className={`text-xs px-2.5 py-1 rounded-full ${miReaccion === 'corazon' ? "bg-red-50 text-red-500" : "bg-white text-slate-400 border border-slate-200"}`}
                      >
                        ❤️ {conteo.corazon || ''}
                      </button>
                    ) : (
                      REACCIONES.map(r => (
                        <button
                          key={r.tipo}
                          onClick={() => alternarReaccion(pub.id, r.tipo)}
                          className={`text-xs px-2.5 py-1 rounded-full ${miReaccion === r.tipo ? "bg-blue-50 text-[#1A6BFF] border border-[#1A6BFF]" : "bg-white text-slate-400 border border-slate-200"}`}
                        >
                          {r.icono} {conteo[r.tipo] || ''}
                        </button>
                      ))
                    )}
                  </div>

                  <button onClick={() => setExpandido(abierto ? null : pub.id)} className="text-slate-400 text-xs mt-2.5">
                    {listaComentarios.length > 0 ? `💬 ${listaComentarios.length} comentario${listaComentarios.length === 1 ? '' : 's'}` : '💬 Comentar'}
                  </button>

                  {abierto && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-100">
                      {listaComentarios.map(c => (
                        <div key={c.id} className="mb-2">
                          <p className="text-slate-700 text-xs font-medium">{c.autor_nombre}</p>
                          <p className="text-slate-600 text-xs">{c.contenido}</p>
                        </div>
                      ))}
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          value={nuevoComentario[pub.id] || ""}
                          onChange={e => setNuevoComentario(prev => ({ ...prev, [pub.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') enviarComentario(pub.id); }}
                          placeholder="Escribe un comentario..."
                          className="flex-1 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-[#1A6BFF]"
                        />
                        <button onClick={() => enviarComentario(pub.id)} className="text-[#1A6BFF] text-xs font-semibold">Enviar</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav pacienteId={pacienteId} activo="historial" />
    </main>
  );
}