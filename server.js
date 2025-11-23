// server.js - versão CommonJS, usa express.json() (sem body-parser extra)
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mercadopago = require("mercadopago");
require("dotenv").config();

const app = express();
app.use(cors());
// use built-in body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Verifica se MP_ACCESS_TOKEN existe (evita crash se faltando)
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("WARNING: MP_ACCESS_TOKEN is not set. Mercado Pago calls will fail.");
}

// Config Mercado Pago
try {
  mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN || ""
  });
} catch (err) {
  console.error("Erro ao configurar Mercado Pago:", err?.message || err);
}

// Rotas de teste
app.get("/", (req, res) => {
  res.send("Backend AfiliadoPRO online 🚀");
});

// Criar pagamento (exemplo simples usando preference -> init_point)
// NOTE: se quiser PIX/Payment API, adapte conforme SDK e ambiente (sandbox/production)
app.post("/mp/create-payment", async (req, res) => {
  try {
    const { plan } = req.body;
    const price = plan === "weekly" ? 5.9 : 19.9;

    const preference = await mercadopago.preferences.create({
      items: [
        { title: `Plano ${plan}`, quantity: 1, unit_price: price }
      ],
      payer: { email: req.body.email || "cliente@example.com" },
      back_urls: {
        success: process.env.FRONTEND_URL || "/",
        failure: process.env.FRONTEND_URL || "/",
        pending: process.env.FRONTEND_URL || "/"
      },
      auto_return: "approved"
    });

    res.json({
      ok: true,
      init_point: preference.body.init_point,
      preference_id: preference.body.id
    });
  } catch (error) {
    console.error("mp create-payment error:", error);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// Webhook Mercado Pago (configurar URL no painel MP -> /mp/webhook)
app.post("/mp/webhook", express.urlencoded({ extended: true }), async (req, res) => {
  try {
    // apenas log para debug; processe conforme precisar
    console.log("MP WEBHOOK RECEBIDO", { body: req.body, query: req.query });
    // retorno 200 rápido
    res.status(200).send("ok");
  } catch (err) {
    console.error("Erro webhook:", err);
    res.status(500).send("error");
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
