import Product from "../../models/Product.js";
import { v4 as uuidv4 } from "uuid";

// Get all products with pagination, search, and filtering
export const getAllProducts = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim();
    const category = req.query.category?.trim();
    const filter = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ title: { $regex: regex } }];
    }

    if (category) filter.category = category;

    const [items, total] = await Promise.all([
      Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Product.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching products", error: err.message });
  }
};

// Get single product
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a product
export const createProduct = async (req, res) => {
  try {
    if (req.body.variants?.length > 0) {
      req.body.variants = req.body.variants.map((v) => ({
        ...v,
        variant_id: uuidv4(),
      }));
    }
    const createdProduct = await Product.create(req.body);
    res.status(201).json({ success: true, data: createdProduct });
  } catch (err) {
    res.status(400).json({ message: "Error creating product", error: err.message });
  }
};

// Update product
export const updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, data: updatedProduct });
  } catch (err) {
    res.status(400).json({ message: "Error updating product", error: err.message });
  }
};

// Delete product
export const deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ message: "Product not found" });
    res.json({ success: true, message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting product", error: err.message });
  }
};

// Add variant
export const addVariant = async (req, res) => {
  try {
    const { variant_name, price, unit_type, grams, options } = req.body;
    if (!variant_name || !price || !unit_type) {
      return res.status(400).json({ message: "variant_name, price, and unit_type are required" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const newVariant = {
      variant_id: uuidv4(),
      variant_name,
      price,
      unit_type,
      grams: grams || null,
      options: options || [],
    };

    product.variants.push(newVariant);
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ message: "Error adding variant", error: err.message });
  }
};

// Update variant
export const updateVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { variant_name, price, unit_type, grams, options } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const variant = product.variants.find((v) => v.variant_id === variantId);
    if (!variant) return res.status(404).json({ message: "Variant not found" });

    if (variant_name !== undefined) variant.variant_name = variant_name;
    if (price !== undefined) variant.price = price;
    if (unit_type !== undefined) variant.unit_type = unit_type;
    if (grams !== undefined) variant.grams = grams;
    if (options !== undefined) variant.options = options;

    await product.save();
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ message: "Error updating variant", error: err.message });
  }
};

// Delete variant
export const deleteVariant = async (req, res) => {
  try {
    const { variantId } = req.params;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const index = product.variants.findIndex((v) => v.variant_id === variantId);
    if (index === -1) return res.status(404).json({ message: "Variant not found" });

    product.variants.splice(index, 1);
    await product.save();
    res.json({ success: true, message: "Variant deleted successfully", data: product });
  } catch (err) {
    res.status(500).json({ message: "Error deleting variant", error: err.message });
  }
};

// Replace all variants
export const replaceAllVariants = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { variants } = req.body;
    if (!variants || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ message: "Please provide at least one variant" });
    }

    product.variants = variants.map((v) => ({
      ...v,
      variant_id: v.variant_id || uuidv4(),
    }));

    await product.save();
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ message: "Error replacing variants", error: err.message });
  }
};
