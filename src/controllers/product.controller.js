import Product from '../models/Product.js';

/**
 * @desc   List products with search, filter, pagination & active status
 * @route  GET /api/products
 */
export async function listProducts(req, res, next) {
  try {
    const {
      q, // search keyword
      category, // filter by category
      page = 1, // pagination page
      limit = 10, // items per page
      isActive = true, // show only active products by default
    } = req.query;

    const filter = {};

    // Active products filter
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

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

    // Fetch products with pagination
    const products = await Product.find(filter)
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const count = await Product.countDocuments(filter);

    res.json({
      data: products,
      page: Number(page),
      total: count,
      pages: Math.ceil(count / limit),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @desc   Get a single product by ID
 * @route  GET /api/products/:id
 */
export async function getProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
}

/**
 * @desc   Create a new product
 * @route  POST /api/products
 */
export async function createProduct(req, res, next) {
  try {
    const { title, description, variants, image, category, isActive, tags } =
      req.body;

    // Basic validation
    if (!title || !variants || variants.length === 0) {
      return res
        .status(400)
        .json({ message: 'Le titre et au moins une variante sont requis' });
    }

    const product = new Product({
      title,
      description,
      variants,
      image,
      category,
      isActive: isActive !== undefined ? isActive : true,
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
    const { title, description, variants, image, category, isActive, tags } =
      req.body;

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Produit introuvable' });
    }

    // Update fields
    product.title = title ?? product.title;
    product.description = description ?? product.description;
    product.variants = variants ?? product.variants;
    product.image = image ?? product.image;
    product.category = category ?? product.category;
    product.isActive = isActive !== undefined ? isActive : product.isActive;
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
