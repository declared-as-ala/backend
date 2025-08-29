import Product from '../models/Product.js';
import Category from '../models/Category.js';

export async function createProduct(req, res, next) {
  try {
    const {
      title,
      description,
      price,
      unit,
      image,
      categoryId,
      inStock,
      tags,
    } = req.body;
    const cat = await Category.findById(categoryId);
    if (!cat) return res.status(400).json({ message: 'Invalid category' });
    const p = await Product.create({
      title,
      description,
      price,
      unit,
      image,
      category: cat._id,
      inStock,
      tags,
    });
    res.status(201).json(p);
  } catch (e) {
    next(e);
  }
}

export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const p = await Product.findByIdAndUpdate(id, req.body, { new: true });
    if (!p) return res.status(404).json({ message: 'Not found' });
    res.json(p);
  } catch (e) {
    next(e);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
