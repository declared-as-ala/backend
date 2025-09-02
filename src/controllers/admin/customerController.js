import Customer from "../../models/Customer.js";

const parsePagination = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const pickPublic = (c) => ({
  id: c._id,
  firstName: c.firstName,
  lastName: c.lastName,
  email: c.email,
  phone: c.phone,
  active: c.active,
  loyaltyPoints: c.loyaltyPoints,
  createdAt: c.createdAt,
});

export const listCustomers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const q = req.query.q?.trim();
    const active = req.query.active;

    const filter = {};
    if (q) {
      filter.$or = [
        { firstName: new RegExp(q, "i") },
        { lastName: new RegExp(q, "i") },
        { email: new RegExp(q, "i") },
        { phone: new RegExp(q, "i") },
      ];
    }
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    const [items, total] = await Promise.all([
      Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Customer.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: items.map(pickPublic),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Customer not found" });
    res.json({ success: true, data: pickPublic(c) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const createCustomer = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, active } =
      req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const exists = await Customer.findOne({
      email: email.toLowerCase().trim(),
    });
    if (exists)
      return res.status(409).json({ message: "Email already registered" });

    const c = await Customer.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      active,
    });
    res.status(201).json({ success: true, data: pickPublic(c) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { firstName, lastName, phone, active } = req.body || {};
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Customer not found" });

    if (typeof firstName === "string") c.firstName = firstName;
    if (typeof lastName === "string") c.lastName = lastName;
    if (typeof phone === "string") c.phone = phone;
    if (typeof active === "boolean") c.active = active;

    await c.save();
    res.json({ success: true, data: pickPublic(c) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Adjust loyalty points (+/-)
export const adjustLoyalty = async (req, res) => {
  try {
    const { delta } = req.body || {};
    if (typeof delta !== "number")
      return res.status(400).json({ message: "delta must be a number" });

    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Customer not found" });

    c.loyaltyPoints = Math.max(0, (c.loyaltyPoints || 0) + delta);
    await c.save();
    res.json({ success: true, data: pickPublic(c) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Deactivate instead of hard delete
export const deactivateCustomer = async (req, res) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Customer not found" });
    c.active = false;
    await c.save();
    res.json({ success: true, data: pickPublic(c) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🆕 Hard delete customer (admin-only)
export const deleteCustomer = async (req, res) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Customer not found" });

    await Customer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Customer deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
