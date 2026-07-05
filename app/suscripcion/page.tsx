"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

declare global {
  interface Window {
    Conekta: {
      setPublicKey: (key: string) => void
      Token: {
        create: (
          params: { card: { number: string; name: string; exp_year: string; exp_month: string; cvc: string } },
          successCallback: (token: { id: string }) => void,
          errorCallback: (error: { message_to_purchaser: string }) => void
        ) => void
      }
    }
  }
}

const LIMITE_USOS_BETA_POR_FAMILIA = 3

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
  const [errorPago, setErrorPago] = useState("")

  const [card, setCard] = useState({
    number: "",
    name: "",
    exp_month: "",
    exp_year: "",
    cvc: "",
  })

  const esBeta = codigoAplicado?.tipo === "beta"

  useEffect(() => {
    if (window.Conekta) {
      window.Conekta.setPublicKey(process.env.NEXT_PUBLIC_CONEKTA_PUBLIC_KEY!)
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/")
  }

  async function aplicarCodigo() {
    setErrorCodigo("")
    setCodigoAplicado(null)
    setLoadingCodigo(true)

    const codigoLimpio = codigo.trim().toUpperCase()

    const { data, error } = await supabase
      .from("codigos_promocionales")
      .select("tipo, descuento_porcentaje, meses_duracion, conekta_plan_id, usos_maximos, usos_actuales, fecha_expiracion")
      .eq("codigo", codigoLimpio)
      .eq("activo", true)
      .single()

    if (error || !data) {
      setLoadingCodigo(false)
      setErrorCodigo("Código no válido o inactivo.")
      return
    }

    if (data.usos_maximos !== null && data.usos_actuales >= data.usos_maximos) {
      setLoadingCodigo(false)
      setErrorCodigo("Este código ya alcanzó el límite de usos.")
      return
    }

    if (data.fecha_expiracion && new Date(data.fecha_expiracion) < new Date()) {
      setLoadingCodigo(false)
      setErrorCodigo("Este código ha expirado.")
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { count, error: countError } = await supabase
        .from("suscripciones")
        .select("id", { count: "exact", head: true })
        .eq("familia_id", user.id)
        .eq("codigo_usado", codigoLimpio)

      if (!countError && data.tipo === "beta" && (count ?? 0) >= LIMITE_USOS_BETA_POR_FAMILIA) {
        setLoadingCodigo(false)
        setErrorCodigo("Ya alcanzaste el límite de usos de este código para tu familia.")
        return
      }
    }

    setLoadingCodigo(false)
    setCodigoAplicado(data)
  }

  function describeBeneficio() {
    if (!codigoAplicado) return ""
    if (codigoAplicado.tipo === "beta") return `✓ ${codigoAplicado.meses_duracion} meses gratuitos aplicados`
    return `✓ ${codigoAplicado.descuento_porcentaje}% de descuento aplicado`
  }

  async function handleActivarBeta() {
    setLoadingPago(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingPago(false); return }

    const fechaVencimiento = new Date(Date.now() + (codigoAplicado!.meses_duracion ?? 3) * 30 * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from("suscripciones").insert({
      familia_id: user.id,
      estado: "trial",
      conekta_plan_id: codigoAplicado!.conekta_plan_id,
      codigo_usado: codigo.trim().toUpperCase(),
      fecha_inicio: new Date().toISOString(),
      fecha_vencimiento: fechaVencimiento,
      trial_usado: true,
    })

    await supabase.rpc("incrementar_uso_codigo", { p_codigo: codigo.trim().toUpperCase() })

    setLoadingPago(false)
    router.push("/dashboard")
  }

  async function handlePagarConTarjeta() {
    setErrorPago("")
    setLoadingPago(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoadingPago(false); return }

    const { data: perfil } = await supabase
      .from("users")
      .select("nombre_completo")
      .eq("id", user.id)
      .single()

    window.Conekta.Token.create(
      {
        card: {
          number: card.number.replace(/\s/g, ""),
          name: card.name,
          exp_year: card.exp_year,
          exp_month: card.exp_month,
          cvc: card.cvc,
        },
      },
      async (token) => {
        const planId = codigoAplicado?.conekta_plan_id ?? "plan-mensual-389"

        const res = await fetch("/api/conekta/suscribir", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: token.id,
            planId,
            familiaId: user.email,
            nombre: perfil?.nombre_completo ?? "Cliente SyncroMedic",
            codigoUsado: codigoAplicado ? codigo.trim().toUpperCase() : null,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setErrorPago("Error al procesar el pago. Verifica tus datos.")
          setLoadingPago(false)
          return
        }

        await supabase.from("suscripciones").insert({
          familia_id: user.id,
          estado: "activa",
          conekta_plan_id: planId,
          conekta_customer_id: data.conekta_customer_id,
          conekta_subscription_id: data.conekta_subscription_id,
          codigo_usado: codigoAplicado ? codigo.trim().toUpperCase() : null,
          fecha_inicio: new Date().toISOString(),
          fecha_vencimiento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          trial_usado: false,
        })

        if (codigoAplicado) {
          await supabase.rpc("incrementar_uso_codigo", { p_codigo: codigo.trim().toUpperCase() })
        }

        setLoadingPago(false)
        router.push("/dashboard")
      },
      (error) => {
        setErrorPago(error.message_to_purchaser)
        setLoadingPago(false)
      }
    )
  }

  const inputStyle = {
    width: "100%",
    padding: "10px 14px",
    borderRadius: "8px",
    border: "1.5px solid #e2e8f0",
    fontSize: "14px",
    outline: "none",
    fontFamily: "Sora, sans-serif",
    boxSizing: "border-box" as const,
  }

  const labelStyle = {
    fontSize: "13px",
    fontWeight: 600,
    color: "#374151",
    display: "block",
    marginBottom: "6px",
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
        <div style={{ textAlign: "right", marginBottom: "8px" }}>
          <button
            onClick={handleLogout}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "Sora, sans-serif",
              textDecoration: "underline",
            }}
          >
            Cerrar sesión
          </button>
        </div>

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
          <div style={{ fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>
            {codigoAplicado?.tipo === "descuento"
              ? `$${(389 * (1 - (codigoAplicado.descuento_porcentaje ?? 0) / 100)).toFixed(2)} MXN`
              : "$389 MXN"}
          </div>
          <div style={{ fontSize: "13px", color: "#64748b" }}>
            {esBeta ? `${codigoAplicado?.meses_duracion} meses gratis · luego $389 MXN/mes` : "por mes · cancela cuando quieras"}
          </div>
        </div>

        <div style={{ marginBottom: "24px" }}>
          <label style={labelStyle}>¿Tienes un código promocional?</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              placeholder="Código promocional (opcional)"
              value={codigo}
              onChange={e => setCodigo(e.target.value.toUpperCase())}
              style={{ ...inputStyle, flex: 1, width: "auto" }}
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
          {errorCodigo && <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "6px" }}>{errorCodigo}</p>}
          {codigoAplicado && <p style={{ color: "#00C97A", fontSize: "13px", marginTop: "6px", fontWeight: 600 }}>{describeBeneficio()}</p>}
        </div>

        {!esBeta && (
          <div style={{ marginBottom: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={labelStyle}>Número de tarjeta</label>
              <input
                type="text"
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                value={card.number}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 16)
                  const formatted = val.match(/.{1,4}/g)?.join(" ") ?? val
                  setCard(c => ({ ...c, number: formatted }))
                }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Nombre en la tarjeta</label>
              <input
                type="text"
                placeholder="Como aparece en tu tarjeta"
                value={card.name}
                onChange={e => setCard(c => ({ ...c, name: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
              <div>
                <label style={labelStyle}>Mes</label>
                <input
                  type="text"
                  placeholder="MM"
                  maxLength={2}
                  value={card.exp_month}
                  onChange={e => setCard(c => ({ ...c, exp_month: e.target.value.replace(/\D/g, "") }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Año</label>
                <input
                  type="text"
                  placeholder="AA"
                  maxLength={2}
                  value={card.exp_year}
                  onChange={e => setCard(c => ({ ...c, exp_year: e.target.value.replace(/\D/g, "") }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>CVC</label>
                <input
                  type="text"
                  placeholder="123"
                  maxLength={4}
                  value={card.cvc}
                  onChange={e => setCard(c => ({ ...c, cvc: e.target.value.replace(/\D/g, "") }))}
                  style={inputStyle}
                />
              </div>
            </div>
            {errorPago && <p style={{ color: "#ef4444", fontSize: "13px" }}>{errorPago}</p>}
          </div>
        )}

        <button
          onClick={esBeta ? handleActivarBeta : handlePagarConTarjeta}
          disabled={loadingPago}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "10px",
            background: loadingPago ? "#94a3b8" : "#1A6BFF",
            color: "white",
            border: "none",
            fontWeight: 700,
            fontSize: "15px",
            cursor: loadingPago ? "not-allowed" : "pointer",
            fontFamily: "Sora, sans-serif",
          }}
        >
          {loadingPago ? "Procesando..." : esBeta ? "Activar acceso gratuito" : "Pagar $389 MXN"}
        </button>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#94a3b8", marginTop: "16px" }}>
          Pago seguro · Cancela cuando quieras
        </p>
      </div>
    </div>
  )
}