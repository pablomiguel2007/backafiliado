// server.js - Versão COMPLETA com Rotas de Autenticação e Estruturas
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const mercadopago = require("mercadopago");
const crypto = require("crypto"); // Para IDs simples

require("dotenv").config();

const app = express();
// Configuração CORS PERMISSIVA para evitar erros de origem
app.use(cors({ origin: '*' })); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variáveis de MOCK em memória
let usersDB = [
  { id: 1, email: "teste@pro.com", password: "password123", structures: [] }
];
// Use uma chave secreta real no seu ambiente de produção
const JWT_SECRET = process.env.JWT_SECRET || "sua_chave_secreta_muito_segura";

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
    // Anexa o usuário ao request (opcional, mas útil)
    req.user = usersDB.find(u => u.id === req.userId);
    if (!req.user) {
        return res.status(401).json({ message: "Usuário não encontrado." });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido ou expirado." });
  }
};

// --- ROTAS DE AUTENTICAÇÃO ---
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
        password, // Em um app real, use hash (bcrypt)!
        structures: []
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
    // Cria um JWT para o frontend
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, message: "Login realizado com sucesso!" });
});

// --- ROTAS DE ESTRUTURAS (PROTEGIDAS) ---
app.get("/structures", authMiddleware, (req, res) => {
    // Retorna as estruturas do usuário autenticado
    res.json({ structures: req.user.structures });
});

app.post("/structures/generate", authMiddleware, (req, res) => {
    const { projectName, pageUrl, affiliateLink } = req.body;
    if (!projectName || !pageUrl || !affiliateLink) {
        return res.status(400).json({ message: "Dados incompletos." });
    }

    // Simulação de 20 segundos para geração (para corresponder ao Frontend)
    setTimeout(() => {
        const newStructure = {
            id: Date.now(),
            project: projectName,
            url: pageUrl,
            affiliate: affiliateLink,
            date: new Date().toLocaleString(),
        };
        req.user.structures.unshift(newStructure);
        // Em um app real, você salvaria isso no banco de dados
        res.status(201).json({ message: "Estrutura gerada com sucesso.", structure: newStructure });
    }, 20000); // 20 segundos
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


// --- ROTAS DE PAGAMENTO (PIX MOCK) ---

// Essa rota simula a GERAÇÃO DE PIX.
// Em um sistema real, você chamaria a API do seu Provedor de Pagamento (ex: Mercado Pago Payment API para PIX).
app.post("/plans/pix", authMiddleware, (req, res) => {
    const { plan, value } = req.body;
    
    // Simulação do código PIX Copia e Cola.
    // O Frontend tem a lógica de geração do QR Code a partir deste payload.
    const MOCKED_PIX_CODE = "00020126330014BR.GOV.BCB.PIX0111" + req.userId + "11223344" + "520400005303986540" + value.toFixed(2).replace('.', '') + "5802BR5909Afiliado6007BRASIL620505TXID12346304" + crypto.randomBytes(2).toString('hex').toUpperCase();

    // Simulação de delay para a geração
    setTimeout(() => {
        res.json({ 
            message: "PIX gerado com sucesso!",
            pix_code: MOCKED_PIX_CODE 
        });
    }, 900);
});


// --- ROTAS DE TESTE E MERCADO PAGO ORIGINAIS ---
app.get("/", (req, res) => {
  res.send("Backend AfiliadoPRO online 🚀");
});

// Nota: As rotas originais do Mercado Pago (mp/create-payment e mp/webhook) foram mantidas,
// mas a rota /plans/pix é usada pelo frontend.
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

