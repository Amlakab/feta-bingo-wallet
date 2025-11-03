"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const accountantSchema = new mongoose_1.default.Schema({
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    phoneNumber: {
        type: String,
        required: true,
        validate: {
            validator: function (v) {
                return /^\d{10,15}$/.test(v);
            },
            message: 'Phone number must be between 10-15 digits'
        }
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function (v) {
                return /^\d{9,18}$/.test(v);
            },
            message: 'Account number must be between 9-18 digits'
        }
    },
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});
// Indexes for better query performance
accountantSchema.index({ accountNumber: 1 });
accountantSchema.index({ phoneNumber: 1 });
accountantSchema.index({ isBlocked: 1 });
accountantSchema.index({ createdAt: 1 });
const Accountant = mongoose_1.default.model('Accountant', accountantSchema);
exports.default = Accountant;
