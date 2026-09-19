"use client";
import Link from "next/link";

type Tab = "inicio" | "bitacora" | "historial" | "ajustes";

/**
 * Menú inferior fijo, presente en toda la app para el rol familia (y variantes
 * de solo lectura para especialista/escuela más adelante).
 *
 * NOTA DE INTEGRACIÓN — rutas que este componente asume y que quedan pendientes:
 * - `/dashboard`: debe redirigir automáticamente al expediente si la familia
 *   tiene un solo paciente (decisión ya tomada), o mostrar la lista si tiene 2+.
 *   Este componente no decide eso, solo apunta ahí.
 * - `/paciente/[id]/bitacora`: pantalla de grid 3xN — todavía no construida.
 * - `/perfil`: pantalla de Perfil/Ajustes — todavía no construida. Ajusta el
 *   href si tu app ya usa otro nombre de ruta para esto.
 * - El botón (+) por ahora navega a `/paciente/[id]?accion=registrar`, que el
 *   Expediente ya escucha para abrir el diario existente. El modal de registro
 *   rápido completo (con las 4 opciones) es una pantalla futura pendiente.
 */
export default function BottomNav({
  pacienteId,
  activo,
}: {
  pacienteId: string;
  activo: Tab;
}) {
  const claseItem = (key: Tab) =>
    `flex flex-col items-center gap-0.5 text-[10px] leading-none transition-colors ${
      activo === key ? "text-[#1A6BFF] font-semibold" : "text-slate-400"
    }`;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around py-2 z-40"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
    >
      <Link href="/dashboard" className={claseItem("inicio")}>
        <span className="text-xl">🏠</span>
        Inicio
      </Link>

      <Link href={`/paciente/${pacienteId}/bitacora`} className={claseItem("bitacora")}>
        <span className="text-xl">📒</span>
        Bitácora
      </Link>

      <Link
        href={`/paciente/${pacienteId}?accion=registrar`}
        className="w-11 h-11 rounded-full bg-[#1A6BFF] flex items-center justify-center -mt-5 shadow-md hover:bg-blue-700 transition-colors"
        aria-label="Registrar"
      >
        <span className="text-white text-2xl leading-none">+</span>
      </Link>

      <Link href={`/paciente/${pacienteId}/timeline`} className={claseItem("historial")}>
        <span className="text-xl">⏱️</span>
        Historial
      </Link>

      <Link href="/perfil" className={claseItem("ajustes")}>
        <span className="text-xl">⚙️</span>
        Ajustes
      </Link>
    </nav>
  );
}