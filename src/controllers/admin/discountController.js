import DiscountCode from "../../models/DiscountCode.js";

const parsePagination = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ✅ Get all discounts (with filters + pagination)
export const getAllDiscounts = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query.q?.trim();
    const active = req.query.active;
    const type = req.query.type;

    const now = new Date();
    const filter = {};
    if (q) filter.code = new RegExp(q, "i");
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;
    if (type) filter.type = type;
    if (req.query.validNow === "true") {
      filter.$and = [
        {
          $or: [
            { validFrom: { $exists: false } },
            { validFrom: { $lte: now } },
          ],
        },
        { $or: [{ validTo: { $exists: false } }, { validTo: { $gte: now } }] },
      ];
    }

    const [items, total] = await Promise.all([
      DiscountCode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      DiscountCode.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Get discount by ID
export const getDiscountById = async (req, res) => {
  try {
    const discount = await DiscountCode.findById(req.params.id);
    if (!discount)
      return res.status(404).json({ message: "Discount not found" });

    res.json({ success: true, data: discount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ✅ Create new discount
export const createDiscount = async (req, res) => {
  try {
    const created = await DiscountCode.create(req.body);
    res.status(201).json({ success: true, data: created });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ✅ Update discount
export const updateDiscount = async (req, res) => {
  try {
    const updated = await DiscountCode.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated)
      return res.status(404).json({ message: "Discount not found" });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// ✅ Delete discount
export const deleteDiscount = async (req, res) => {
  try {
    const discount = await DiscountCode.findById(req.params.id);
    if (!discount)
      return res.status(404).json({ message: "Discount not found" });

    await DiscountCode.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Discount deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔄 Toggle discount active/inactive
export const toggleDiscountActive = async (req, res) => {
  try {
    const discount = await DiscountCode.findById(req.params.id);
    if (!discount)
      return res.status(404).json({ message: "Discount not found" });

    discount.active = !discount.active;
    await discount.save();
    res.json({ success: true, data: discount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ➕ Increment usage manually (optional)
export const incrementUsage = async (req, res) => {
  try {
    const discount = await DiscountCode.findByIdAndUpdate(
      req.params.id,
      { $inc: { usedCount: 1 } },
      { new: true }
    );
    if (!discount)
      return res.status(404).json({ message: "Discount not found" });

    res.json({ success: true, data: discount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
