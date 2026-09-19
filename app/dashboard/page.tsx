"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Rol = 'familia' | 'medico' | 'terapeuta' | 'centro_terapias' | 'escuela' | 'admin'

const SALUDO_ROL: Record<string, string> = {
  medico:          'Dr.',
  terapeuta:       'Lic.',
  centro_terapias: '',
  escuela:         '',
  familia:         '',
}

const badgeRolLabel: Record<string, string> = {
  medico:          'Médico',
  terapeuta:       'Terapeuta',
  centro_terapias: 'Centro de terapias',
  escuela:         'Escuela',
}

function calcularEdad(fechaNacimiento: string) {
  const hoy = new Date();
  const nacimiento = new Date(fechaNacimiento);
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const m = hoy.getMonth() - nacimiento.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
  return edad;
}

function formatFecha(fecha: string) {
  return new Date(fecha).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
}

function badgeEstado(estado: string) {
  const map: Record<string, { label: string; color: string }> = {
    activa:    { label: "Activa", color: "#00C97A" },
    trial:     { label: "Periodo beta", color: "#1A6BFF" },
    vencida:   { label: "Vencida", color: "#ef4444" },
    cancelada: { label: "Cancelada", color: "#94a3b8" },
    pausada:   { label: "Pausada", color: "#f59e0b" },
  }
  return map[estado] ?? { label: estado, color: "#94a3b8" }
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [pacientes, setPacientes] = useState<any[]>([]);
  const [rol, setRol] = useState<Rol>('familia');
  const [loading, setLoading] = useState(true);
  const [redirigiendo, setRedirigiendo] = useState(false);
  const [suscripcion, setSuscripcion] = useState<any>(null);
  const [cancelando, setCancelando] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function cargarDatos() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }
      setUser(user);

      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

      const rolDetectado: Rol = userData?.role || user.user_metadata?.role || 'familia';
      setRol(rolDetectado);

      let pacientesEncontrados: any[] = [];

      if (rolDetectado === 'familia') {
        const { data } = await supabase
          .from("pacientes")
          .select("*")
          .eq("familia_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        pacientesEncontrados = data || [];
        setPacientes(pacientesEncontrados);

        const { data: suscripciones } = await supabase
          .from("suscripciones")
          .select("*")
          .eq("familia_id", user.id)
          .order("created_at", { ascending: false });

        const activa = suscripciones?.find(s =>
          (s.estado === "activa" || s.estado === "trial") &&
          new Date(s.fecha_vencimiento) > new Date()
        )
        setSuscripcion(activa || suscripciones?.[0] || null)
      } else {
        const { data: accesos } = await supabase
          .from("expediente_accesos")
          .select("paciente_id")
          .eq("usuario_id", user.id)
          .eq("estado", "activo");

        const ids = (accesos || []).map((a: any) => a.paciente_id);

        if (ids.length > 0) {
          const { data: pacientesData } = await supabase
            .from("pacientes")
            .select("*")
            .in("id", ids);
          pacientesEncontrados = pacientesData || [];
          setPacientes(pacientesEncontrados);
        }
      }

      // Decisión de producto: con un solo paciente, esta pantalla se salta
      // por completo — se va directo a su expediente.
      if (pacientesEncontrados.length === 1) {
        setRedirigiendo(true);
        router.replace(`/paciente/${pacientesEncontrados[0].id}`);
        return;
      }

      setLoading(false);
    }
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  async function handleCancelar() {
    if (!confirm("¿Seguro que deseas cancelar tu suscripción? Perderás acceso al vencimiento actual.")) return
    setCancelando(true)
    await supabase
      .from("suscripciones")
      .update({ estado: "cancelada" })
      .eq("id", suscripcion.id)
    setSuscripcion({ ...suscripcion, estado: "cancelada" })
    setCancelando(false)
  }

  if (!user || loading || redirigiendo) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400 text-sm">Cargando...</p>
      </main>
    );
  }

  const esFamilia = rol === 'familia';
  const nombreUsuario = user.user_metadata?.full_name || user.user_metadata?.nombre || user.email
  const primerNombre = nombreUsuario?.split(" ")[0] || ''
  const prefijo = SALUDO_ROL[rol] ?? ''
  const tituloLista = esFamilia ? 'Tus peques' : 'Pacientes'

  return (
    <main className="min-h-screen bg-white pb-10">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* Header simple: saludo + salir */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-slate-900 text-lg font-semibold">
              {`Hola, ${prefijo ? prefijo + ' ' : ''}${primerNombre} 👋`}
            </p>
            {!esFamilia && badgeRolLabel[rol] && (
              <span className="text-[11px] bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold inline-block mt-1">
                {badgeRolLabel[rol]}
              </span>
            )}
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-slate-700 text-sm transition-colors">
            Salir
          </button>
        </div>

        <p className="text-[#00C97A] text-[11px] font-semibold tracking-wide uppercase mb-0.5">SyncroMedic</p>
        <h1 className="text-slate-900 text-xl font-semibold mb-4">{tituloLista}</h1>

        {pacientes.length === 0 ? (
          <div className="bg-slate-50 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-3">{esFamilia ? '👶' : '🩺'}</p>
            <h2 className="text-slate-800 font-semibold text-sm mb-1.5">
              {esFamilia ? 'Registra tu primer paciente' : 'Sin pacientes asignados'}
            </h2>
            <p className="text-slate-400 text-xs mb-5">
              {esFamilia
                ? 'Crea el expediente de tu hijo para empezar a coordinar su equipo médico'
                : 'Cuando una familia te invite, verás sus pacientes aquí'}
            </p>
            {esFamilia && (
              <Link
                href="/paciente/nuevo"
                className="bg-[#1A6BFF] hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors inline-block"
              >
                Crear expediente
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {pacientes.map((paciente) => (
              <Link
                key={paciente.id}
                href={`/paciente/${paciente.id}`}
                className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3 no-underline"
              >
                <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                  👤
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 text-sm font-semibold truncate">{paciente.apodo || paciente.nombre}</p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {calcularEdad(paciente.fecha_nacimiento)} años
                    {paciente.diagnosticos_principales?.length > 0 && ` · ${paciente.diagnosticos_principales.join(", ")}`}
                  </p>
                </div>
                <span className="text-slate-300 text-lg flex-shrink-0">›</span>
              </Link>
            ))}

            {esFamilia && (
              <Link
                href="/paciente/nuevo"
                className="border border-dashed border-blue-200 bg-blue-50/40 rounded-2xl p-4 flex items-center gap-3 no-underline"
              >
                <div className="w-11 h-11 rounded-full bg-blue-50 flex items-center justify-center text-lg flex-shrink-0">
                  ➕
                </div>
                <p className="text-[#1A6BFF] text-sm font-semibold">Crear nuevo expediente</p>
              </Link>
            )}
          </div>
        )}

        {/* Mi Suscripción — solo familia, misma lógica de siempre */}
        {esFamilia && suscripcion && (
          <div className="mt-8">
            <p className="text-slate-400 text-xs uppercase tracking-wide mb-2.5">Mi suscripción</p>
            <div className="bg-slate-50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">💳</span>
                  <div>
                    <p className="text-slate-800 text-sm font-semibold">
                      {suscripcion.conekta_plan_id === "plan-beta-3meses" ? "Plan Beta" : "Plan Mensual $389 MXN"}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {suscripcion.codigo_usado ? `Código: ${suscripcion.codigo_usado}` : "Sin código promocional"}
                    </p>
                  </div>
                </div>
                <span
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{
                    background: badgeEstado(suscripcion.estado).color + "20",
                    color: badgeEstado(suscripcion.estado).color,
                  }}
                >
                  {badgeEstado(suscripcion.estado).label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <p className="text-slate-400 text-[11px] mb-0.5">Inicio</p>
                  <p className="text-slate-700 text-xs font-medium">{formatFecha(suscripcion.fecha_inicio)}</p>
                </div>
                <div>
                  <p className="text-slate-400 text-[11px] mb-0.5">
                    {suscripcion.estado === "cancelada" ? "Acceso hasta" : "Próxima renovación"}
                  </p>
                  <p className="text-slate-700 text-xs font-medium">{formatFecha(suscripcion.fecha_vencimiento)}</p>
                </div>
              </div>

              {(suscripcion.estado === "activa" || suscripcion.estado === "trial") && (
                <button
                  onClick={handleCancelar}
                  disabled={cancelando}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors underline"
                >
                  {cancelando ? "Cancelando..." : "Cancelar suscripción"}
                </button>
              )}

              {suscripcion.estado === "cancelada" && (
                <p className="text-xs text-slate-400">
                  Tu suscripción fue cancelada. Tendrás acceso hasta el {formatFecha(suscripcion.fecha_vencimiento)}.
                </p>
              )}

              {suscripcion.estado === "vencida" && (
                <Link href="/suscripcion" className="text-xs text-[#1A6BFF] font-semibold hover:underline">
                  Renovar suscripción →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}