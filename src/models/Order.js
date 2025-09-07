import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    items: [
      {
        productId: { type: String, required: true },
        variantId: { type: String, required: true },
        name: { type: String, required: true },
        variantUnit: { type: String, required: true },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        currency: { type: String, default: 'EUR' },
        image: { type: String },
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

    // Nouveau champ pour livraison
    isDelivered: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Hook pour définir le statut et livraison automatiquement
orderSchema.pre('save', function (next) {
  if (!this.isModified('status')) {
    if (this.pickupType === 'delivery') {
      this.status = this.paymentMethod === 'espèces' ? 'en_attente' : 'payé';
      this.isDelivered = false;
    } else if (this.pickupType === 'store') {
      this.status = this.paymentMethod === 'espèces' ? 'en_attente' : 'payé';
      this.isDelivered = true; // retrait magasin = considéré comme livré
    }
  }
  next();
});

// Méthode pour marquer la commande comme terminée / livrée
orderSchema.methods.marquerLivree = function () {
  if (this.pickupType === 'delivery') {
    this.isDelivered = true;
    this.status = 'terminé';
    return this.save();
  }
  return Promise.resolve(this); // retrait magasin déjà livré
};

orderSchema.methods.marquerTermine = function () {
  this.status = 'terminé';
  if (this.pickupType === 'delivery') this.isDelivered = true;
  return this.save();
};

// Indexes
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ stripePaymentIntentId: 1 });
orderSchema.index({ paypalOrderId: 1 });
orderSchema.index({ discountCode: 1 });

export default mongoose.model('Order', orderSchema);
