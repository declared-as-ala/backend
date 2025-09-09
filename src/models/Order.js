import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        variantId: { type: String, required: true },
        productTitle: { type: String, required: true },
        variantName: { type: String, default: '' },
        unitType: { type: String, enum: ['weight', 'piece'], required: true },
        grams: { type: Number, default: null },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        total: { type: Number, required: true },
        image: { type: String, required: true },
        currency: { type: String, default: 'EUR' },
      },
    ],

    customer: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      isAdmin: { type: Boolean, default: false },
    },

    pickupType: {
      type: String,
      enum: ['store', 'delivery'],
      required: true,
    },

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

    /** 🆕 Delivery Time Feature **/
    deliveryTime: {
      type: String, // Ex: "14:30" or "2025-09-07T14:30:00Z"
      required: function () {
        return this.pickupType === 'delivery';
      },
    },

    deliveryFee: { type: Number, default: 0 },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'EUR' },

    discountCode: { type: String },
    discountAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ['en_attente', 'payé', 'terminé', 'annulé'],
      default: 'en_attente',
    },

    paymentMethod: {
      type: String,
      enum: ['stripe', 'paypal', 'espèces'],
      required: true,
    },

    stripePaymentIntentId: { type: String },
    paypalOrderId: { type: String },
    notes: { type: String },
    isDelivered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hook: auto-set status & delivery flag
orderSchema.pre('save', function (next) {
  if (!this.isModified('status')) {
    this.status = this.paymentMethod === 'espèces' ? 'en_attente' : 'payé';
    this.isDelivered = this.pickupType === 'store';
  }
  next();
});

orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model('Order', orderSchema);
