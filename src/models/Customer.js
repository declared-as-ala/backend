
import { Schema, model } from 'mongoose';
import bcrypt from 'bcryptjs';

const customerSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    phone: { type: String, trim: true },
    loyaltyPoints: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

customerSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

export default model('Customer', customerSchema);
