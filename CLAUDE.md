@AGENTS.md

# SyncroMedic — Contexto del proyecto

## Qué es
Expediente médico compartido entre especialistas para familias que coordinan el
cuidado de hijos con múltiples especialistas (neurólogo, psicólogo, terapeutas, etc.).
Las familias son dueñas del expediente y lo documentan; los especialistas leen
contexto en vez de re-preguntar la historia clínica en cada consulta.

Fundador/desarrollador único: Oscar (GitHub: ohzdan). Usa la plataforma con su
propia familia — no es solo un producto comercial, es una herramienta que él mismo
depende para coordinar la atención de su hija.

## Stack técnico
- Next.js (App Router, TypeScript)
- Supabase (PostgreSQL + Auth + RLS + Storage)
- Tailwind CSS
- Deploy: Vercel (deploy directo a producción en cada push, sin dev server local)
- Pagos: Conekta (procesador mexicano)
- Cliente de Supabase: import desde `@/lib/supabase` (archivo único `lib/supabase.ts`)

## Repos e infraestructura
- App: `ohzdan/syncromedic` → `app.syncromedic.com`
- Landing: `ohzdan/syncromedic-landing` (HTML estático, deploy separado en Vercel)
- Supabase project ID: `zdxmiqirebefsmflaemn`
- Dominio via Hostinger (CNAME/A records → Vercel)

## ⚠️ Cumplimiento regulatorio (NO NEGOCIABLE)
Siempre señala proactivamente si algo puede entrar en conflicto con:

- **NOM-004-SSA3-2012**: contenido del expediente clínico. Notas clínicas deben
  seguir formato SOAP, requieren firma electrónica, deben usar codificación CIE-10
  para diagnósticos, requieren consentimiento informado, y usan **borrado lógico**
  (`deleted_at`), nunca DELETE físico. Las entradas de la familia (bitácora) son
  una categoría legal separada — "bitácora familiar", NO notas clínicas de médico.
- **NOM-024-SSA3-2012**: datos encriptados, acceso autenticado, bitácora de
  auditoría (`audit_log`, inmutable). Datos sensibles como CURP deben ir cifrados
  en reposo, no solo protegidos por RLS.

## Roles
`familia`, `medico`, `terapeuta`, `centro_terapias`, `escuela`, `admin`.
- `medico`/`terapeuta`/`centro_terapias`: acceso de solo lectura a Timeline,
  Documentos y Medicamentos.
- `escuela`: restringido solo a la sección de Recomendaciones. (Pendiente: toggle
  de permisos para ocultar medicamentos/timeline a este rol.)
- `familia` (dueño del paciente) NO aparece en `expediente_accesos` — necesita
  ramas de política RLS separadas.

## Patrones de base de datos importantes
- Recursión circular entre `pacientes` y `expediente_accesos` se resuelve con
  `EXISTS`, no `IN` subqueries.
- Storage paths deben empezar con `${pacienteId}/` como primer segmento para
  calzar con las políticas RLS.
- `tipo_documento` enum en Postgres: `estudio`, `receta`, `analisis`, `reporte`,
  `otro` — el frontend debe mapear categorías via el objeto `CATEGORIA_A_TIPO_ENUM`.
- Patrón de "silent success" de Supabase en registro con email duplicado:
  `data.user.identities.length === 0` indica cuenta existente, no nueva.
- `noche_fecha` en bitácora de sueño representa la fecha de **despertar**, no de
  acostarse — eventos que cruzan medianoche se anclan al día calendario anterior.
- Conekta no tiene objetos nativos de cupón/descuento para suscripciones
  recurrentes — los descuentos se manejan con planes de Conekta separados.

## Convenciones de entrega de código
- Oscar necesita **archivos completos listos para pegar** (Ctrl+A y reemplazar en
  VS Code) — nunca diffs parciales ni snippets, salvo que estemos trabajando
  directo sobre el archivo real vía Claude Code.
- Terminal: PowerShell/CMD en Windows.
- Siempre confirmar antes de hacer `git push` o cualquier escritura a producción.
- Antes de escribir en la base de datos de Supabase, preferir modo de solo lectura
  o branches de desarrollo cuando la operación no sea trivial.

## Estado del negocio (contexto, no técnico)
- Modelo: suscripción mensual en MXN por familia, códigos promocionales, tiers de
  descuento (múltiplos de 5% hasta 20%), comisiones de canal (10% centros
  referentes, 5% promotores adicionales).
- Estructura legal: SAS en trámite (e.firma es el prerequisito crítico).
- Go-to-market: validación interna (familia propia) → familias beta sin costo →
  primeros clientes de pago. La pareja de Oscar lidera ventas/outreach con
  especialistas.
