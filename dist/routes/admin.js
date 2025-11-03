"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adminController_1 = require("../controllers/adminController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// All admin routes require authentication and admin role
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('admin'));
// User management
router.get('/users', adminController_1.getUsers);
router.get('/users/:id', adminController_1.getUser);
router.put('/users/:id', adminController_1.updateUser);
// Game management
router.get('/games', adminController_1.getGames);
router.get('/games/:id', adminController_1.getGame);
router.post('/games', adminController_1.createGame);
router.put('/games/:id', adminController_1.updateGame);
// Transaction management
router.get('/transactions', adminController_1.getTransactions);
router.put('/transactions/:id', adminController_1.updateTransaction);
// Analytics
router.get('/analytics', adminController_1.getAnalytics);
exports.default = router;
