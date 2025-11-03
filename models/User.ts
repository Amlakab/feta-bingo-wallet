import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  phone: string;
  password: string;
  role: 'user' | 'disk-user'| 'spinner-user' | 'accountant' |'agent' | 'admin';
  wallet: number;
  dailyEarnings: number;
  weeklyEarnings: number;
  totalEarnings: number;
  tg_id: string; // Added tg_id
  agent_id?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<IUser>({
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
    enum: ['user','disk-user', 'spinner-user', 'accountant', 'agent', 'admin'],
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
  tg_id: { // Added tg_id field
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/, 'Please enter a valid Telegram username (e.g., @amlakie or amlakie)']
  },
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
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

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Reset daily earnings at the start of each day
userSchema.methods.resetDailyEarnings = function() {
  this.dailyEarnings = 0;
  return this.save();
};

// Reset weekly earnings at the start of each week
userSchema.methods.resetWeeklyEarnings = function() {
  this.weeklyEarnings = 0;
  return this.save();
};

export default mongoose.model<IUser>('User', userSchema);