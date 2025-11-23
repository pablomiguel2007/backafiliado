const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const mercadopago = require("mercadopago");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Config Mercado Pago
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// Test route
app.get("/", (req, res) => {
  res.send("Backend AfiliadoPRO online 🚀");
});

// Criar pagamento PIX
app.post("/create-pix", async (req, res) => {
  try {
    const { plan } = req.body;

    const price = plan === "weekly" ? 5.9 : 19.9;

    const preference = await mercadopago.payment.create({
      transaction_amount: price,
      description: `AfiliadoPRO - Plano ${plan}`,
      payment_method_id: "pix",
      payer: { email: "cliente@example.com" },
    });

    res.json({
      qr: preference.body.point_of_interaction.transaction_data.qr_code_base64,
      code: preference.body.point_of_interaction.transaction_data.qr_code,
      id: preference.body.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao gerar PIX" });
  }
});

// Webhook Mercado Pago
app.post("/webhook", async (req, res) => {
  console.log("Webhook recebido:", req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
