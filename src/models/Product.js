import { Schema, model } from 'mongoose';

const variantSchema = new Schema(
  {
    id: { type: String, required: true, trim: true }, // unique variant ID
    quantity: { type: Number, required: true, default: 1 },
    unit: {
      type: String,
      enum: ['500g', '1kg', 'pièce', 'g', 'kg'],
      required: true,
    },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'EUR' },
    isDefault: { type: Boolean, default: false },
    stock: { type: Number, default: 0 },
  },
  { _id: false } // no separate _id for variants
);

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    variants: {
      type: [variantSchema],
      validate: {
        validator: function (v) {
          return v && v.length > 0;
        },
        message: 'Un produit doit avoir au moins une variante.',
      },
    },
    image: { type: String, default: '' },
    category: { type: String, default: 'Uncategorized' },
    isActive: { type: Boolean, default: true },
    tags: [{ type: String }],
  },
  {
    timestamps: true, // auto adds createdAt & updatedAt
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export default model('Product', productSchema);
