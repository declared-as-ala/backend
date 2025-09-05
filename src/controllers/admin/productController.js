

import Product from "../../models/Product.js";
import { v4 as uuidv4 } from "uuid";


export const getAllProducts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();
    const category = req.query.category?.trim();
    const active = req.query.active;
    const sortBy = req.query.sortBy || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? 1 : -1;

    const filter = {};

    // 🔍 Search by title or tags
    if (search) {
      const regex = new RegExp(search, "i");

      // Only include tags filter if there are tags
      filter.$or = [{ title: { $regex: regex } }, { tags: { $in: [regex] } }];
    }

    // Filter by category if provided
    if (category) filter.category = category;

    // Filter by active status if provided
    if (active === "true") filter.isActive = true;
    if (active === "false") filter.isActive = false;

    // Execute query with pagination and sorting
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
    console.error(err);
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
    // Ensure each variant gets a unique ID
    if (req.body.variants && req.body.variants.length > 0) {
      req.body.variants = req.body.variants.map((variant) => ({
        ...variant,
        id: uuidv4(),
      }));
    }

    const createdProduct = await Product.create(req.body);
    res.status(201).json({ success: true, data: createdProduct });
  } catch (err) {
    res
      .status(400)
      .json({ message: "Error creating product", error: err.message });
  }
};

// ✅ Update product
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
    res
      .status(400)
      .json({ message: "Error updating product", error: err.message });
  }
};

// ✅ Delete product
export const deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct)
      return res.status(404).json({ message: "Product not found" });

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting product", error: err.message });
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

//////////////////////////
// VARIANT MANAGEMENT 🧩 //
//////////////////////////

// ➕ Add a new variant
export const addVariant = async (req, res) => {
  try {
    const {
      unit,
      price,
      stock,
      quantity = 1,
      currency = "EUR",
      isDefault = false,
    } = req.body;
    if (!unit || !price)
      return res.status(400).json({ message: "Unit and price are required" });

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const newVariant = {
      id: uuidv4(),
      unit,
      price,
      stock: stock ?? 0,
      quantity,
      currency,
      isDefault,
    };

    product.variants.push(newVariant);
    await product.save();

    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error adding variant", error: err.message });
  }
};

// ✏️ Update an existing variant
export const updateVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { price, stock, unit, quantity } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return res.status(404).json({ message: "Variant not found" });

    if (price !== undefined) variant.price = price;
    if (stock !== undefined) variant.stock = stock;
    if (unit !== undefined) variant.unit = unit;
    if (quantity !== undefined) variant.quantity = quantity;

    await product.save();
    res.json({ success: true, data: product });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error updating variant", error: err.message });
  }
};

// ❌ Delete a variant
export const deleteVariant = async (req, res) => {
  try {
    const { variantId } = req.params;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const variantIndex = product.variants.findIndex((v) => v.id === variantId);
    if (variantIndex === -1)
      return res.status(404).json({ message: "Variant not found" });

    product.variants.splice(variantIndex, 1);
    await product.save();

    res.json({
      success: true,
      message: "Variant deleted successfully",
      data: product,
    });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error deleting variant", error: err.message });
  }
};

// 📦 Update stock when buying
export const updateVariantStock = async (req, res) => {
  try {
    const { variantId, quantity } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) return res.status(404).json({ message: "Variant not found" });

    if (typeof quantity !== "number" || quantity <= 0)
      return res
        .status(400)
        .json({ message: "Quantity must be a positive number" });

    if (variant.stock < quantity)
      return res.status(400).json({ message: "Not enough stock available" });

    variant.stock -= quantity;
    await product.save();

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
// 🔄 Replace all variants at once
export const replaceAllVariants = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { variants } = req.body;
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return res
        .status(400)
        .json({ message: "Please provide at least one variant" });
    }

    // Give unique IDs to each new variant
    product.variants = variants.map((variant) => ({
      ...variant,
      id: variant.id || uuidv4(),
    }));

    await product.save();
    res.json({ success: true, data: product });
  } catch (err) {
    res
      .status(500)
      .json({ message: "Error replacing variants", error: err.message });
  }
};
