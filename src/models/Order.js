import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    items: [
      {
        productId: { type: String, required: true }, // Product ID
        variantId: { type: String, required: true }, // ✅ Variant ID
        name: { type: String, required: true }, // Product title
        variantUnit: { type: String, required: true }, // ✅ 500g | 1kg | pièce
        quantity: { type: Number, required: true },
        price: { type: Number, required: true }, // Price per variant
        currency: { type: String, default: 'EUR' }, // Always match variant currency
        image: { type: String }, // Optional - product image
      },
    ],

    customer: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },

    pickupType: {
      type: String,
      enum: ['store', 'delivery'],
      required: true,
    },

    // Store full pickup location details instead of just ID
    pickupLocation: {
      id: { type: String },
      name: { type: String },
      address: { type: String },
      description: { type: String },
    },

    deliveryAddress: {
      street: String,
      postalCode: String,
      city: String,
      country: String,
    },

    deliveryFee: { type: Number, default: 0 },
    amount: { type: Number, required: true }, // ✅ total order amount
    currency: { type: String, default: 'EUR' },

    // Discount fields
    discountCode: { type: String },
    discountAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'completed', 'cancelled'],
      default: 'pending',
    },

    // Payment method identifiers
    stripePaymentIntentId: { type: String },
    paypalOrderId: { type: String },

    notes: { type: String },
  },
  { timestamps: true }
);

// Indexes for better performance
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ stripePaymentIntentId: 1 });
orderSchema.index({ paypalOrderId: 1 });
orderSchema.index({ discountCode: 1 });

export default mongoose.model('Order', orderSchema);
