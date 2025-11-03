"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// server/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const transactions_1 = __importDefault(require("./routes/transactions"));
const auth_1 = __importDefault(require("./routes/auth"));
const game_1 = __importDefault(require("./routes/game"));
const games_1 = __importDefault(require("./routes/games"));
const accountant_1 = __importDefault(require("./routes/accountant"));
const wallet_1 = __importDefault(require("./routes/wallet"));
const admin_1 = __importDefault(require("./routes/admin"));
const agent_1 = __importDefault(require("./routes/agent"));
const user_1 = __importDefault(require("./routes/user"));
const spinner_1 = __importDefault(require("./routes/spinner"));
const feedback_1 = __importDefault(require("./routes/feedback"));
const database_1 = require("./config/database");
const gameSocket_1 = require("./sockets/gameSocket");
const errorHandler_1 = require("./middleware/errorHandler");
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
// Socket.io setup with ALL origins permitted
const io = new socket_io_1.Server(server, {
    cors: {
        origin: "*", // Allow ALL origins
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["*"] // Allow ALL headers
    },
    path: '/socket.io/',
    transports: ['websocket', 'polling']
});
// Middleware - Allow ALL CORS origins
app.use((0, cors_1.default)({
    origin: "*", // Allow ALL origins
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers", "*"]
}));
// Handle preflight requests for ALL routes
app.options('*', (0, cors_1.default)({
    origin: "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["*"]
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use('/api/user', user_1.default);
app.use('/api/auth', auth_1.default);
app.use('/api/game', game_1.default);
app.use('/api/wallet', wallet_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/agent', agent_1.default);
app.use('/api/games', games_1.default);
app.use('/api/transactions', transactions_1.default);
app.use('/api/feedback', feedback_1.default);
app.use('/api/accountants', accountant_1.default);
app.use('/api/spinner', spinner_1.default);
// Enhanced health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        message: 'Server is running',
        cors: 'All origins permitted',
        timestamp: new Date().toISOString(),
        origin: req.headers.origin || 'Unknown'
    });
});
// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
    res.status(200).json({
        message: 'CORS is working! All origins allowed.',
        yourOrigin: req.headers.origin,
        timestamp: new Date().toISOString(),
        allowed: true
    });
});
// WebSocket endpoint for clients that need raw WebSocket
app.get('/ws', (req, res) => {
    res.status(400).json({ error: 'Use Socket.io client instead' });
});
// Socket.io setup
(0, gameSocket_1.setupSocket)(io);
// Error handling middleware
app.use(errorHandler_1.errorHandler);
// Connect to database
(0, database_1.connectDB)();
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 CORS: ALL origins permitted`);
    console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`✅ Health check: http://localhost:${PORT}/api/health`);
    console.log(`✅ CORS test: http://localhost:${PORT}/api/cors-test`);
    console.log(`📱 Mobile apps can connect from any origin`);
});
