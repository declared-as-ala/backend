import Product from '../models/Product.js';
import { connectDB } from '../config/db-vercel.js';

/**
 * @desc   List products with search, filter, pagination
 * @route  GET /api/products
 */
export async function listProducts(req, res, next) {
  try {
    // Ensure database connection
    await connectDB();

    const {
      q, // search keyword
      category, // filter by category
      page = 1, // pagination page
      limit = 10, // items per page
    } = req.query;

    const filter = {};

    // Search by title or description
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }

    // Filter by category
    if (category) {
      filter.category = category;
    }

    // Pagination calculation
    const pageNumber = Number(page) > 0 ? Number(page) : 1;
    const limitNumber = Number(limit) > 0 ? Number(limit) : 10;
    const skip = (pageNumber - 1) * limitNumber;

    // Log the filter for debugging
    console.log('[listProducts] Filter:', filter, 'Page:', pageNumber, 'Limit:', limitNumber);

    // Fetch products with filter, pagination, and sort
    const products = await Product.find(filter)
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 })
      .maxTimeMS(10000); // 10 second timeout

    // Total count
    const total = await Product.countDocuments(filter).maxTimeMS(10000);

    res.json({
      data: products,
      page: pageNumber,
      total,
      pages: Math.ceil(total / limitNumber),
    });
  } catch (err) {
    console.error('[listProducts] Error:', err);
    
    // Handle specific MongoDB errors
    if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        message: 'Service temporarily unavailable. Please try again later.',
        error: 'Database connection timeout'
      });
    }
    
    next(err);
  }
}

/**
 * @desc   Get a single product by ID
 * @route  GET /api/products/:id
 */
export async function getProduct(req, res, next) {
  try {
    // Ensure database connection
    await connectDB();
    
    const product = await Product.findById(req.params.id).maxTimeMS(10000);
    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    res.json(product);
  } catch (err) {
    console.error('[getProduct] Error:', err);
    
    // Handle specific MongoDB errors
    if (err.name === 'MongooseError' && err.message.includes('buffering timed out')) {
      return res.status(503).json({ 
        message: 'Service temporarily unavailable. Please try again later.',
        error: 'Database connection timeout'
      });
    }
    
    next(err);
  }
}

/**
 * @desc   Create a new product
 * @route  POST /api/products
 */
export async function createProduct(req, res, next) {
  try {
    const { title, description, variants, image, category, tags } = req.body;

    if (!title || !variants || variants.length === 0) {
      return res.status(400).json({ message: 'Le titre et au moins une variante sont requis' });
    }

    const product = new Product({
      title,
      description,
      variants,
      image,
      category,
      tags,
    });

    const savedProduct = await product.save();
    res.status(201).json(savedProduct);
  } catch (err) {
    next(err);
  }
}

/**
 * @desc   Update an existing product
 * @route  PUT /api/products/:id
 */
export async function updateProduct(req, res, next) {
  try {
    const { title, description, variants, image, category, tags } = req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    product.title = title ?? product.title;
    product.description = description ?? product.description;
    product.variants = variants ?? product.variants;
    product.image = image ?? product.image;
    product.category = category ?? product.category;
    product.tags = tags ?? product.tags;

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (err) {
    next(err);
  }
}

/**
 * @desc   Delete a product
 * @route  DELETE /api/products/:id
 */
export async function deleteProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    await product.deleteOne();
    res.json({ message: 'Produit supprimé avec succès' });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc   Get all categories (distinct)
 * @route  GET /api/products/categories
 */
export async function listCategories(req, res, next) {
  try {
    const categories = await Product.distinct('category');
    res.json(categories);
  } catch (err) {
    next(err);
  }
}
