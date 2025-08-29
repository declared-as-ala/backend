import { Schema, model } from 'mongoose';

const productSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    unit: { type: String, default: 'kg' },
    image: { type: String, default: '' },
    category: { type: String, default: 'Uncategorized' },
    inStock: { type: Boolean, default: true },
    tags: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString(); // إضافة id
        delete ret._id; // حذف _id
        delete ret.__v; // حذف __v لو مش محتاجه
        return ret;
      },
    },
  }
);

export default model('Product', productSchema);
