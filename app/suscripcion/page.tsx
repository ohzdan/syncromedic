"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function SuscripcionPage() {
  const supabase = createClient()
  const router = useRouter()
  const [codigo, setCodigo] = useState("")
  const [codigoAplicado, setCodigoAplicado] = useState<null | {
    tipo: string
    descuento_porcentaje: number | null
    meses_duracion: number | null
    conekta_plan_id: string
  }>(null)
  const [errorCodigo, setErrorCodigo] = useState("")
  const [loadingCodigo, setLoadingCodigo] = useState(false)
  const [loadingPago, setLoadingPago] = useState(false)

  async function aplicarCodigo() {
    setErrorCodigo("")
    setCodigoAplicado(null)
    setLoadingCodigo(true)

    const { data, error } = await supabase
      .from("codigos_promocionales")
      .select("tipo, descuento_porcentaje, meses_duracion, conekta_plan_id, usos_maximos, usos_actuales, fecha_expiracion")
      .eq("codigo", codigo.trim().toUpperCase())
      .eq("activo", true)
      .single()

    setLoadingCodigo(false)

    if (error || !data) {
      setErrorCodigo("Código no válido o inactivo.")
      return
    }

    if (data.usos_maximos !== null && data.usos_actuales >= data.usos_maximos) {
      setErrorCodigo("Este código ya alcanzó el límite de usos.")
      return
    }

    if (data.fecha_expiracion && new Date(data.fecha_expiracion) < new Date()) {
      setErrorCodigo("Este código ha expirado.")
      return
    }

    setCodigoAplicado(data)
  }

  function describeBeneficio() {
    if (!codigoAplicado) return ""
    if (codigoAplicado.tipo === "beta") {
      return `✓ ${codigoAplicado.meses_duracion} meses gratuitos aplicados`
    }
    return `✓ ${codigoAplicado.descuento_porcentaje}% de descuento aplicado`
  }

  async function handleActivar() {
    setLoadingPago(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingPago(false); return }

    const planId = codigoAplicado?.conekta_plan_id ?? "plan-mensual-full"
    const fechaVencimiento = codigoAplicado?.tipo === "beta"
      ? new Date(Date.now() + (codigoAplicado.meses_duracion ?? 3) * 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from("suscripciones").insert({
      familia_id: user.id,
      estado: codigoAplicado?.tipo === "beta" ? "trial" : "activa",
      conekta_plan_id: planId,
      codigo_usado: codigoAplicado ? codigo.trim().toUpperCase() : null,
      fecha_inicio: new Date().toISOString(),
      fecha_vencimiento: fechaVencimiento,
      trial_usado: codigoAplicado?.tipo === "beta",
    })

    if (codigoAplicado) {
      await supabase.rpc("incrementar_uso_codigo", { p_codigo: codigo.trim().toUpperCase() })
    }

    setLoadingPago(false)
    router.push("/dashboard")
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f8fafc",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "Sora, sans-serif",
      padding: "24px",
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "40px",
        maxWidth: "480px",
        width: "100%",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>💙</div>
          <h1 style={{ fontSize: "22px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            Activa tu cuenta
          </h1>
          <p style={{ color: "#64748b", marginTop: "8px", fontSize: "14px" }}>
            El expediente compartido de tu familia
          </p>
        </div>

        <div style={{
          background: "#f1f5f9",
          borderRadius: "12px",
          padding: "20px",
          marginBottom: "24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>$389 MXN</div>
          <div style={{ fontSize: "13px", color: "#64748b" }}>por mes · cancela cuando quieras</div>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={{ fontSize: "13px", fontWeight: 600, color: "#374151", display: "block", marginBottom: "8px" }}>
            ¿Tienes un código promocional?
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder="Ej. BETA2026"
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1.5px solid #e2e8f0",
                fontSize: "14px",
                outline: "none",
                fontFamily: "Sora, sans-serif",
              }}
            />
            <button
              onClick={aplicarCodigo}
              disabled={!codigo || loadingCodigo}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                background: "#1A6BFF",
                color: "white",
                border: "none",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                fontFamily: "Sora, sans-serif",
              }}
            >
              {loadingCodigo ? "..." : "Aplicar"}
            </button>
          </div>
          {errorCodigo && (
            <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "6px" }}>{errorCodigo}</p>
          )}
          {codigoAplicado && (
            <p style={{ color: "#00C97A", fontSize: "13px", marginTop: "6px", fontWeight: 600 }}>
              {describeBeneficio()}
            </p>
          )}
        </div>

        <button
          onClick={handleActivar}
          disabled={loadingPago}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "10px",
            background: "#1A6BFF",
            color: "white",
            border: "none",
            fontWeight: 700,
            fontSize: "15px",
            cursor: "pointer",
            fontFamily: "Sora, sans-serif",
          }}
        >
          {loadingPago ? "Activando..." : codigoAplicado?.tipo === "beta" ? "Activar acceso gratuito" : "Continuar al pago"}
        </button>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#94a3b8", marginTop: "16px" }}>
          Al activar aceptas nuestros términos de servicio
        </p>
      </div>
    </div>
  )
}