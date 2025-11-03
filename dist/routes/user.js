"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const userController_1 = require("../controllers/userController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Public routes
router.post('/register', userController_1.createUser);
// Protected routes (require authentication)
router.get('/stats', auth_1.authenticate, userController_1.getUserStatistics);
router.get('/', auth_1.authenticate, userController_1.getAllUsers);
router.get('/:userId', auth_1.authenticate, userController_1.getUser);
router.put('/wallet', auth_1.authenticate, userController_1.updateWallet);
router.put('/earnings', auth_1.authenticate, userController_1.updateEarnings);
router.patch('/:userId/status', auth_1.authenticate, userController_1.updateUserStatus);
router.delete('/:userId', auth_1.authenticate, userController_1.deleteUser);
router.put('/change-password', auth_1.authenticate, userController_1.changePassword);
router.put('/update-wallet', auth_1.authenticate, userController_1.setWallet);
router.put('/minus-wallet', auth_1.authenticate, userController_1.minusWallet);
router.get('/agent/:agentId', auth_1.authenticate, userController_1.getUsersByAgentId);
exports.default = router;
