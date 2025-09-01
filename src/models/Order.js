import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    // Articles de la commande
    items: [
      {
        productId: { type: String, required: true },      // ID du produit
        variantId: { type: String, required: true },      // ID de la variante
        name: { type: String, required: true },           // Nom du produit
        variantUnit: { type: String, required: true },    // 500g | 1kg | pièce
        quantity: { type: Number, required: true },       // Quantité
        price: { type: Number, required: true },          // Prix par variante
        currency: { type: String, default: 'EUR' },       // Devise
        image: { type: String },                           // Image optionnelle
      },
    ],

    // Informations client
    customer: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },

    // Type de retrait
    pickupType: {
      type: String,
      enum: ['store', 'delivery'], // 'store' = retrait magasin, 'delivery' = livraison
      required: true,
    },

    // Détails du lieu de retrait
    pickupLocation: {
      id: { type: String },
      name: { type: String },
      address: { type: String },
      description: { type: String },
    },

    // Adresse de livraison
    deliveryAddress: {
      street: String,
      postalCode: String,
      city: String,
      country: String,
    },

    deliveryFee: { type: Number, default: 0 }, // Frais de livraison
    amount: { type: Number, required: true },  // Montant total de la commande
    currency: { type: String, default: 'EUR' },

    // Remises
    discountCode: { type: String },
    discountAmount: { type: Number, default: 0 },

    // Statut de la commande
    status: { 
      type: String, 
      enum: ['en_attente', 'payé', 'échoué', 'terminé', 'annulé'], 
      default: 'en_attente' 
    },

    // Mode de paiement
    paymentMethod: { 
      type: String, 
      enum: ['stripe', 'paypal', 'espèces'], 
      required: true 
    },

    // Identifiants paiement
    stripePaymentIntentId: { type: String },
    paypalOrderId: { type: String },

    notes: { type: String }, // Notes optionnelles
  },
  { timestamps: true }
);

// Hook pour définir le statut automatiquement selon le type de retrait et le mode de paiement
orderSchema.pre('save', function (next) {
  if (!this.isModified('status')) {
    if (this.pickupType === 'delivery') {
      this.status = this.paymentMethod === 'espèces' ? 'en_attente' : 'payé';
    } else if (this.pickupType === 'store') {
      this.status = this.paymentMethod === 'espèces' ? 'en_attente' : 'payé';
    }
  }
  next();
});

// Méthode pour marquer la commande comme terminée
orderSchema.methods.marquerTermine = function() {
  this.status = 'terminé';
  return this.save();
};

// Indexes pour améliorer les performances
orderSchema.index({ 'customer.email': 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ stripePaymentIntentId: 1 });
orderSchema.index({ paypalOrderId: 1 });
orderSchema.index({ discountCode: 1 });

export default mongoose.model('Order', orderSchema);
