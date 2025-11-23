// server.js - Versão COMPLETA com Pagamento PIX e Webhook
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mercadopago = require("mercadopago");
const crypto = require("crypto"); 
require("dotenv").config();

const app = express();
// Configuração CORS PERMISSIVA
app.use(cors({ origin: '*' })); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variáveis de MOCK em memória (Em um ambiente real, use um Banco de Dados!)
let usersDB = [
  { 
    id: 1, 
    email: "teste@pro.com", 
    password: "password123", 
    structures: [],
    planStatus: 'free' // NOVO: 'free' ou 'pro'
  }
];

const JWT_SECRET = process.env.JWT_SECRET || "pablomiguel2007";
const RENDER_URL = process.env.https://backafiliado-2.onrender.comL; // Ex: https://backafiliado-2.onrender.com

// Verifica e Configura Mercado Pago
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("WARNING: MP_ACCESS_TOKEN is not set. Mercado Pago calls will fail.");
} else if (!RENDER_URL) {
    console.error("ERRO: RENDER_URL não está configurada! Webhooks não funcionarão.");
}

try {
  mercadopago.configure({
    access_token: process.env.MP_ACCESS_TOKEN || ""
  });
} catch (err) {
  console.error("Erro ao configurar Mercado Pago:", err?.message || err);
}

// --- MIDDLEWARE DE AUTENTICAÇÃO ---
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Token não fornecido." });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.user = usersDB.find(u => u.id === req.userId);
    if (!req.user) {
        return res.status(401).json({ message: "Usuário não encontrado." });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
};

// --- ROTAS DE AUTENTICAÇÃO E STATUS (NOVA ROTA) ---

app.post("/auth/register", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ message: "E-mail e senha (min 6 chars) são obrigatórios." });
    }
    if (usersDB.find(u => u.email === email)) {
        return res.status(409).json({ message: "E-mail já registrado." });
    }
    const newUser = { 
        id: usersDB.length + 1, 
        email, 
        password, 
        structures: [],
        planStatus: 'free' // Novo usuário sempre começa como free
    };
    usersDB.push(newUser);
    res.status(201).json({ message: "Usuário registrado com sucesso. Prossiga para o login." });
});

app.post("/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = usersDB.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({ message: "E-mail ou senha inválidos." });
    }
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    
    // Retorna o status do plano na resposta de login
    res.json({ token, message: "Login realizado com sucesso!", planStatus: user.planStatus }); 
});

// NOVA ROTA: Checa o status do plano para o frontend
app.get("/auth/status", authMiddleware, (req, res) => {
    res.json({ 
        planStatus: req.user.planStatus,
        email: req.user.email
    });
});

// --- ROTAS DE ESTRUTURAS (MANTIDAS) ---
app.get("/structures", authMiddleware, (req, res) => {
    res.json({ structures: req.user.structures });
});

app.post("/structures/generate", authMiddleware, (req, res) => {
    const { projectName, pageUrl, affiliateLink } = req.body;
    if (!projectName || !pageUrl || !affiliateLink) {
        return res.status(400).json({ message: "Dados incompletos." });
    }
    // Opcional: checar se é PRO para liberar geração mais rápida ou mais recursos

    setTimeout(() => {
        const newStructure = {
            id: Date.now(),
            project: projectName,
            url: pageUrl,
            affiliate: affiliateLink,
            date: new Date().toLocaleString(),
        };
        req.user.structures.unshift(newStructure);
        res.status(201).json({ message: "Estrutura gerada com sucesso.", structure: newStructure });
    }, 20000); 
});

app.delete("/structures/:id", authMiddleware, (req, res) => {
    const structureId = parseInt(req.params.id);
    const initialLength = req.user.structures.length;
    
    req.user.structures = req.user.structures.filter(s => s.id !== structureId);
    
    if (req.user.structures.length < initialLength) {
        return res.json({ message: "Estrutura excluída com sucesso." });
    } else {
        return res.status(404).json({ message: "Estrutura não encontrada." });
    }
});


// --- ROTAS DE PAGAMENTO (INTEGRAÇÃO REAL MP PIX) ---

app.post("/plans/pix", authMiddleware, async (req, res) => {
    const { plan } = req.body;
    const value = plan === 'weekly' ? 5.90 : 19.90;
    const user = req.user;

    if (user.planStatus === 'pro') {
        return res.status(400).json({ message: "Você já possui o plano PRO ativo." });
    }
    
    // Dados para o Mercado Pago Payment API (PIX)
    const paymentData = {
        transaction_amount: value,
        description: `Plano AfiliadoPRO - ${plan}`,
        payment_method_id: 'pix',
        payer: {
            // É crucial usar o e-mail real do usuário
            email: user.email, 
            first_name: `User${user.id}`,
            identification: { // O Mercado Pago exige algum tipo de identificação para PIX
                type: 'CPF', 
                number: '99999999999' 
            }
        },
        // Metadata é crucial: armazena o ID do usuário para que o webhook saiba quem atualizar.
        metadata: {
            user_id: user.id,
            plan_type: plan
        },
        // URL para onde o Mercado Pago enviará a notificação
        notification_url: `${https://backafiliado-2.onrender.com}/mp/webhook`, 
        // Em ambiente de produção, configure o URL de retorno (back_urls)
    };

    try {
        const paymentResponse = await mercadopago.payment.create(paymentData);

        // O PIX é retornado no objeto point_of_interaction
        const pixCode = paymentResponse.body.point_of_interaction.transaction_data.qr_code;

        res.json({ 
            message: "PIX gerado com sucesso!",
            pix_code: pixCode,
            payment_id: paymentResponse.body.id // Útil para debug
        });
    } catch (error) {
        console.error("Erro ao gerar PIX MP:", error);
        res.status(500).json({ error: "Erro ao gerar PIX. Verifique seu MP_ACCESS_TOKEN." });
    }
});


// --- WEBHOOK MERCADO PAGO (PARA CONFIRMAÇÃO) ---

app.post("/mp/webhook", async (req, res) => {
  try {
    // Mercado Pago envia o tópico e o ID do recurso na query string
    const topic = req.query.topic; 
    const resourceId = req.query.id; 

    if (topic === 'payment' && resourceId) {
        // Busca o pagamento na API do Mercado Pago
        const payment = await mercadopago.payment.get(resourceId);
        const paymentStatus = payment.body.status;
        const metadata = payment.body.metadata;

        console.log(`WEBHOOK RECEBIDO - ID: ${resourceId}, Status: ${paymentStatus}, UserID: ${metadata.user_id}`);

        // Se o pagamento for aprovado E tiver o user_id na metadata
        if (paymentStatus === 'approved' && metadata.user_id) {
            const userId = metadata.user_id;
            const user = usersDB.find(u => u.id === userId);
            
            if (user) {
                // VERIFICAÇÃO FINAL: Impede que um usuário já PRO compre novamente (em um app real, faria a renovação)
                if (user.planStatus === 'free') {
                    user.planStatus = 'pro';
                    console.log(`✅ USUÁRIO ${userId} ATUALIZADO PARA PRO VIA WEBHOOK`);
                } else {
                    console.log(`⚠️ Usuário ${userId} já é PRO. Pagamento ignorado para novo plano.`);
                }
            } else {
                console.error(`❌ Usuário ${userId} não encontrado no DB.`);
            }
        }
    }
    
    // SEMPRE retorne 200 OK rapidamente, mesmo que a lógica falhe.
    res.status(200).send("ok");
  } catch (err) {
    console.error("Erro webhook:", err);
    // Se houver um erro, retorne um status de erro para que o MP tente novamente
    res.status(500).send("error"); 
  }
});

// --- ROTA DE TESTE ---
app.get("/", (req, res) => {
  res.send("Backend AfiliadoPRO online 🚀");
});


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

