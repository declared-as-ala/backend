import Product from "../../models/Product.js";

const parsePagination = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ✅ Get all products (with search, filter, sort, pagination)
export const getAllProducts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query.q?.trim();
    const category = req.query.category;
    const active = req.query.active;
    const sortBy = req.query.sortBy || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const filter = {};
    if (q) {
      filter.$or = [
        { title: new RegExp(q, "i") },
        { tags: new RegExp(q, "i") },
      ];
    }
    if (category) filter.category = category;
    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;

    const [items, total] = await Promise.all([
      Product.find(filter)
        .sort({ [sortBy]: sortDir })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching products",
      error: err.message,
    });
  }
};

// ✅ Get single product by ID
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Create a new product
export const createProduct = async (req, res) => {
  try {
    const createdProduct = await Product.create(req.body);
    res.status(201).json({ success: true, data: createdProduct });
  } catch (err) {
    res.status(400).json({
      message: "Error creating product",
      error: err.message,
    });
  }
};

// ✅ Update product by ID
export const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedProduct)
      return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, data: updatedProduct });
  } catch (err) {
    res.status(400).json({
      message: "Error updating product",
      error: err.message,
    });
  }
};

// ✅ Delete product by ID
export const deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct)
      return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({
      message: "Error deleting product",
      error: err.message,
    });
  }
};

// 🔄 Toggle product active status
export const toggleActive = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.isActive = !product.isActive;
    await product.save();

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 📦 Update stock of a specific variant
export const updateVariantStock = async (req, res) => {
  try {
    const { variantId, stock } = req.body || {};
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return res.status(404).json({ message: "Variant not found" });

    if (typeof stock !== "number")
      return res.status(400).json({ message: "Stock must be a number" });

    variant.stock = stock;
    await product.save();

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
