import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { token, planId, familiaId } = await req.json()

    const privateKey = process.env.CONEKTA_PRIVATE_KEY!
    const authHeader = "Basic " + Buffer.from(privateKey + ":").toString("base64")

    // 1. Crear cliente en Conekta
    const clienteRes = await fetch("https://api.conekta.io/customers", {
      method: "POST",
      headers: {
        "Accept": "application/vnd.conekta-v2.2.0+json",
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        name: familiaId,
        email: familiaId,
        payment_sources: [{
          type: "card",
          token_id: token,
        }],
      }),
    })

    const cliente = await clienteRes.json()
    console.log("CONEKTA CLIENTE STATUS:", clienteRes.status)
    console.log("CONEKTA CLIENTE RESPONSE:", JSON.stringify(cliente))

    if (!clienteRes.ok) {
      return NextResponse.json({ error: cliente }, { status: 400 })
    }

    // 2. Crear suscripción en Conekta
    const suscRes = await fetch(`https://api.conekta.io/customers/${cliente.id}/subscription`, {
      method: "POST",
      headers: {
        "Accept": "application/vnd.conekta-v2.2.0+json",
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        plan: planId,
      }),
    })

    const suscripcion = await suscRes.json()
    console.log("CONEKTA SUSCRIPCION STATUS:", suscRes.status)
    console.log("CONEKTA SUSCRIPCION RESPONSE:", JSON.stringify(suscripcion))

    if (!suscRes.ok) {
      return NextResponse.json({ error: suscripcion }, { status: 400 })
    }

    return NextResponse.json({
      ok: true,
      conekta_customer_id: cliente.id,
      conekta_subscription_id: suscripcion.id,
    })

  } catch (err) {
    console.error("Error Conekta:", err)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}