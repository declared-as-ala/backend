import { Schema, model } from 'mongoose';

const variantSchema = new Schema(
  {
    variant_id: { type: String, required: true, trim: true },
    variant_name: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    unit_type: {
      type: String,
      enum: ['weight', 'piece'],
      required: true,
    },
    grams: { type: Number, default: null },
    options: {
      type: [{ name: String, value: String }],
      default: [],
    },
  },
  { _id: false } // no separate _id for variants
);

const productSchema = new Schema(
  {
    Image: { type: String, required: true, trim: true, unique: true },
    title: { type: String, required: true, trim: true },
    category: { type: String, default: 'Uncategorized', index: true },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (v) => v && v.length > 0,
        message: 'Un produit doit avoir au moins une variante.',
      },
    },
    rawVariantsExist: { type: Boolean, default: true },
  },
  {
    timestamps: true,
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
