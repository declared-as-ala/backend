import Product from '../models/Product.js';

// List products with optional search & pagination
export async function listProducts(req, res, next) {
  try {
    const { q, category, page = 1, limit = 10 } = req.query;

    const filter = {};
    if (category) filter.category = category; // category is just a string now
    if (q) filter.title = { $regex: q, $options: 'i' };

    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const count = await Product.countDocuments(filter);

    res.json({ data: products, page: Number(page), total: count });
  } catch (err) {
    next(err);
  }
}

// Get a single product by ID
export async function getProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
}
