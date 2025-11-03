"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const userSchema = new mongoose_1.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [/^09\d{8}$/, 'Please enter a valid Ethiopian phone number']
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    role: {
        type: String,
        enum: ['user', 'disk-user', 'spinner-user', 'accountant', 'agent', 'admin'],
        default: 'user',
    },
    wallet: {
        type: Number,
        default: 20,
        min: 0,
    },
    dailyEarnings: {
        type: Number,
        default: 0,
        min: 0,
    },
    weeklyEarnings: {
        type: Number,
        default: 0,
        min: 0,
    },
    totalEarnings: {
        type: Number,
        default: 0,
        min: 0,
    },
    tg_id: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        match: [/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/, 'Please enter a valid Telegram username (e.g., @amlakie or amlakie)']
    },
    agent_id: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User', // agent is also a user
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
}, {
    timestamps: true,
});
userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    try {
        const salt = await bcryptjs_1.default.genSalt(10);
        this.password = await bcryptjs_1.default.hash(this.password, salt);
        next();
    }
    catch (error) {
        next(error);
    }
});
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcryptjs_1.default.compare(candidatePassword, this.password);
};
// Reset daily earnings at the start of each day
userSchema.methods.resetDailyEarnings = function () {
    this.dailyEarnings = 0;
    return this.save();
};
// Reset weekly earnings at the start of each week
userSchema.methods.resetWeeklyEarnings = function () {
    this.weeklyEarnings = 0;
    return this.save();
};
exports.default = mongoose_1.default.model('User', userSchema);
