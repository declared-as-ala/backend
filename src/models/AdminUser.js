import { Schema, model } from 'mongoose';
import bcrypt from 'bcrypt';

const adminUserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    name: { type: String, default: '' },
    role: {
      type: String,
      enum: ['admin', 'manager', 'staff'],
      default: 'admin',
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

adminUserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const rounds = Number(process.env.PASSWORD_SALT_ROUNDS || 12);
  this.password = await bcrypt.hash(this.password, rounds);
  next();
});

adminUserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default model('AdminUser', adminUserSchema);
