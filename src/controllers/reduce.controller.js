// src/controllers/discount.controller.js
import DiscountCode from '../models/DiscountCode.js';

/**
 * Validate a discount code
 */
export const validateDiscountCode = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({ message: 'Code promo requis' });
    }

    // Find the discount code
    const discount = await DiscountCode.findOne({
      code: code.toUpperCase(),
      active: true,
    });

    if (!discount) {
      return res.status(404).json({ message: 'Code promo invalide ou expiré' });
    }

    // Check if code is within valid date range
    const now = new Date();
    if (discount.validFrom && now < discount.validFrom) {
      return res
        .status(400)
        .json({ message: "Ce code promo n'est pas encore actif" });
    }

    if (discount.validTo && now > discount.validTo) {
      return res.status(400).json({ message: 'Ce code promo a expiré' });
    }

    // Check usage limit
    if (discount.usageLimit && discount.usedCount >= discount.usageLimit) {
      return res
        .status(400)
        .json({ message: "Ce code promo a atteint sa limite d'utilisation" });
    }

    res.json({
      code: discount.code,
      type: discount.type,
      discount: discount.discount,
      isValid: true,
    });
  } catch (error) {
    console.error('Error validating discount code:', error);
    res
      .status(500)
      .json({ message: 'Erreur lors de la validation du code promo' });
  }
};

/**
 * Apply discount code to order (increment usage count)
 */
export const applyDiscountCode = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: 'Code promo requis' });
    }

    const discount = await DiscountCode.findOneAndUpdate(
      {
        code: code.toUpperCase(),
        active: true,
      },
      { $inc: { usedCount: 1 } },
      { new: true }
    );

    if (!discount) {
      return res.status(404).json({ message: 'Code promo invalide' });
    }

    res.json({
      message: 'Code promo appliqué avec succès',
      usedCount: discount.usedCount,
    });
  } catch (error) {
    console.error('Error applying discount code:', error);
    res
      .status(500)
      .json({ message: "Erreur lors de l'application du code promo" });
  }
};

/**
 * Get all discount codes (admin only)
 */
export const getAllDiscountCodes = async (req, res) => {
  try {
    const discounts = await DiscountCode.find().sort({ createdAt: -1 });
    res.json(discounts);
  } catch (error) {
    console.error('Error fetching discount codes:', error);
    res
      .status(500)
      .json({ message: 'Erreur lors de la récupération des codes promo' });
  }
};

/**
 * Create new discount code (admin only)
 */
export const createDiscountCode = async (req, res) => {
  try {
    const { code, type, discount, validFrom, validTo, usageLimit } = req.body;

    if (!code || !type || !discount) {
      return res.status(400).json({
        message: 'Code, type et montant de réduction sont requis',
      });
    }

    if (type === 'percentage' && (discount < 0 || discount > 100)) {
      return res.status(400).json({
        message: 'Le pourcentage doit être entre 0 et 100',
      });
    }

    if (type === 'fixed' && discount < 0) {
      return res.status(400).json({
        message: 'Le montant fixe ne peut pas être négatif',
      });
    }

    const newDiscount = new DiscountCode({
      code: code.toUpperCase(),
      type,
      discount,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validTo: validTo ? new Date(validTo) : undefined,
      usageLimit,
    });

    await newDiscount.save();

    res.status(201).json({
      message: 'Code promo créé avec succès',
      discount: newDiscount,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Ce code promo existe déjà' });
    }
    console.error('Error creating discount code:', error);
    res
      .status(500)
      .json({ message: 'Erreur lors de la création du code promo' });
  }
};

/**
 * Update discount code (admin only)
 */
export const updateDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const discount = await DiscountCode.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!discount) {
      return res.status(404).json({ message: 'Code promo introuvable' });
    }

    res.json({
      message: 'Code promo mis à jour avec succès',
      discount,
    });
  } catch (error) {
    console.error('Error updating discount code:', error);
    res
      .status(500)
      .json({ message: 'Erreur lors de la mise à jour du code promo' });
  }
};

/**
 * Delete discount code (admin only)
 */
export const deleteDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await DiscountCode.findByIdAndDelete(id);

    if (!discount) {
      return res.status(404).json({ message: 'Code promo introuvable' });
    }

    res.json({ message: 'Code promo supprimé avec succès' });
  } catch (error) {
    console.error('Error deleting discount code:', error);
    res
      .status(500)
      .json({ message: 'Erreur lors de la suppression du code promo' });
  }
};
