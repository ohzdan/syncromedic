"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

type TipoDatoCampo = 'escala_1_5' | 'numero' | 'hora_unica' | 'rango_horas' | 'si_no' | 'texto_corto';

type CampoPaciente = {
  id: string;
  catalogo_slug: string | null;
  nombre: string;
  tipo_dato: TipoDatoCampo;
  icono: string | null;
  es_personalizado: boolean;
};

type RegistroGenerico = {
  campo_paciente_id: string;
  fecha: string;
  hora_inicio: string | null;
  hora_fin: string | null;
  valor_numero: number | null;
  valor_texto: string | null;
  valor_booleano: boolean | null;
};

type TarjetaBitacora = {
  key: string;
  href: string;
  icono: string;
  titulo: string;
  valor: string;
  disponible: boolean;
};

function horaHHMM(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuracion(inicioISO: string, finISO: string) {
  const ms = new Date(finISO).getTime() - new Date(inicioISO).getTime();
  if (ms <= 0) return null;
  const horas = Math.floor(ms / 3600000);
  const minutos = Math.round((ms % 3600000) / 60000);
  return `${horas}h ${minutos}m`;
}

function formatFechaCorta(fechaISO: string) {
  return new Date(fechaISO + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

/** Formatea el último valor de un campo genérico según su tipo de dato, para la tarjeta del grid. */
function formatValorCampo(campo: CampoPaciente, registro: RegistroGenerico | undefined): string {
  if (!registro) return "Sin registros";
  switch (campo.tipo_dato) {
    case 'escala_1_5':
      return registro.valor_numero != null ? `Nivel ${registro.valor_numero}` : "Sin registros";
    case 'numero':
      return registro.valor_numero != null ? String(registro.valor_numero) : "Sin registros";
    case 'hora_unica':
      return registro.hora_inicio ? horaHHMM(registro.hora_inicio) : "Sin registros";
    case 'rango_horas':
      return registro.hora_inicio && registro.hora_fin ? (formatDuracion(registro.hora_inicio, registro.hora_fin) ?? "Sin registros") : "Sin registros";
    case 'si_no':
      return registro.valor_booleano == null ? "Sin registros" : (registro.valor_booleano ? "Sí" : "No");
    case 'texto_corto':
      return registro.valor_texto ? (registro.valor_texto.length > 18 ? registro.valor_texto.slice(0, 18) + "…" : registro.valor_texto) : "Sin registros";
    default:
      return "Sin registros";
  }
}

export default function BitacoraGrid() {
  const [cargando, setCargando] = useState(true);
  const [nombreParaEquipo, setNombreParaEquipo] = useState("");
  const [tarjetas, setTarjetas] = useState<TarjetaBitacora[]>([]);
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function cargar() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/"); return; }

      const pacienteId = params.id as string;

      const { data: paciente } = await supabase
        .from('pacientes')
        .select('nombre, apodo')
        .eq('id', pacienteId)
        .single();
      if (!paciente) { router.push('/dashboard'); return; }
      setNombreParaEquipo(paciente.apodo || paciente.nombre);

      const resultado: TarjetaBitacora[] = [];

      // --- Campos legacy: Sueño, Evacuación, Pipí nocturno (viven en bitacora_registros) ---
      const { data: ultimoFin } = await supabase
        .from('bitacora_registros')
        .select('noche_fecha, hora_inicio')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'sueno_fin')
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();

      let valorSueno = "Sin registros";
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
        if (inicioMismaNoche) {
          valorSueno = formatDuracion(inicioMismaNoche.hora_inicio, ultimoFin.hora_inicio) ?? "Sin registros";
        }
      }
      resultado.push({ key: 'sueno', href: `/paciente/${pacienteId}/bitacora/sueno`, icono: '😴', titulo: 'Sueño', valor: valorSueno, disponible: true });

      const { data: ultimaEvac } = await supabase
        .from('bitacora_registros')
        .select('consistencia, hora_inicio')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'evacuacion')
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      resultado.push({
        key: 'evacuacion',
        href: `/paciente/${pacienteId}/bitacora/evacuaciones`,
        icono: '💧',
        titulo: 'Evacuación',
        valor: ultimaEvac?.consistencia ? `${ultimaEvac.consistencia} · ${formatFechaCorta(ultimaEvac.hora_inicio.slice(0, 10))}` : "Sin registros",
        disponible: true,
      });

      const { data: ultimoPipi } = await supabase
        .from('bitacora_registros')
        .select('noche_fecha, pipi_nocturno')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'pipi_nocturno')
        .is('deleted_at', null)
        .order('hora_inicio', { ascending: false })
        .limit(1)
        .maybeSingle();
      resultado.push({
        key: 'pipi',
        href: `/paciente/${pacienteId}/bitacora/sueno`,
        icono: '🚽',
        titulo: 'Pipí nocturno',
        valor: ultimoPipi ? (ultimoPipi.pipi_nocturno ? `Sí · ${formatFechaCorta(ultimoPipi.noche_fecha)}` : `No · ${formatFechaCorta(ultimoPipi.noche_fecha)}`) : "Sin registros",
        disponible: true,
      });

      // --- Campos del catálogo ampliado (built-in extra + personalizados) ---
      const { data: campos } = await supabase
        .from('bitacora_campos_paciente')
        .select('id, catalogo_slug, nombre, tipo_dato, icono, es_personalizado')
        .eq('paciente_id', pacienteId)
        .eq('activo', true)
        .is('deleted_at', null);

      if (campos && campos.length > 0) {
        const { data: registros } = await supabase
          .from('bitacora_registros_generico')
          .select('campo_paciente_id, fecha, hora_inicio, hora_fin, valor_numero, valor_texto, valor_booleano')
          .eq('paciente_id', pacienteId)
          .is('deleted_at', null)
          .order('fecha', { ascending: false });

        for (const campo of campos as CampoPaciente[]) {
          const ultimo = (registros || []).find(r => r.campo_paciente_id === campo.id) as RegistroGenerico | undefined;
          resultado.push({
            key: campo.id,
            href: `/paciente/${pacienteId}/bitacora/campo/${campo.id}`,
            icono: campo.icono || '📊',
            titulo: campo.nombre,
            valor: formatValorCampo(campo, ultimo),
            disponible: true,
          });
        }
      }

      setTarjetas(resultado);
      setCargando(false);
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (cargando) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-slate-400">Cargando bitácora...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-24">
      <div className="max-w-lg mx-auto px-4 pt-6">
        <p className="text-[#00C97A] text-[11px] font-semibold tracking-wide uppercase mb-0.5">Bitácora</p>
        <h1 className="text-slate-900 text-xl font-semibold mb-5">{nombreParaEquipo}</h1>

        <div className="grid grid-cols-3 gap-2.5">
          {tarjetas.map(t => (
            <Link
              key={t.key}
              href={t.href}
              className="aspect-square bg-slate-50 rounded-2xl p-3 flex flex-col justify-between no-underline"
            >
              <span className="text-lg">{t.icono}</span>
              <div>
                <p className="text-slate-400 text-[10px] leading-tight">{t.titulo}</p>
                <p className="text-slate-800 text-xs font-semibold leading-tight mt-0.5">{t.valor}</p>
              </div>
            </Link>
          ))}
        </div>

        <p className="text-slate-300 text-[11px] text-center mt-6">
          Solo se muestran las bitácoras activadas en Ajustes
        </p>
      </div>

      <BottomNav pacienteId={params.id as string} activo="bitacora" />
    </main>
  );
}