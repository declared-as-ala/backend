import { Schema, model } from 'mongoose';

const discountSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    discount: { type: Number, required: true }, // % or fixed amount in the order currency
    active: { type: Boolean, default: true },
    validFrom: { type: Date },
    validTo: { type: Date },
    usageLimit: { type: Number }, // optional
    usedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default model('DiscountCode', discountSchema);
