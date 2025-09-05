import Customer from "../../models/Customer.js";

// Helper: parse pagination info
const parsePagination = (q) => {
  const page = Math.max(parseInt(q.page) || 1, 1);
  const limit = Math.min(parseInt(q.limit) || 20, 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// Helper: pick only public fields
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

/**
 * @desc Get paginated customers list
 * @route GET /api/customers?search=&limit=&page=&active=
 */
export const listCustomers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search?.trim(); // 🔹 use `search`
    const active = req.query.active;

    const filter = {};

    // 🔍 Search by name, email, or phone
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, "i") },
        { lastName: new RegExp(search, "i") },
        { email: new RegExp(search, "i") },
        { phone: new RegExp(search, "i") },
      ];
    }

    // ✅ Active status filter if provided
    if (active === "true") filter.active = true;
    if (active === "false") filter.active = false;

    // Fetch paginated customers and total count
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

/**
 * @desc Get customer by ID
 * @route GET /api/customers/:id
 */
export const getCustomerById = async (req, res) => {
  try {
    const c = await Customer.findById(req.params.id);
    if (!c) return res.status(404).json({ message: "Customer not found" });
    res.json({ success: true, data: pickPublic(c) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Create new customer
 * @route POST /api/customers
 */
export const createCustomer = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, active } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const exists = await Customer.findOne({ email: email.toLowerCase().trim() });
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

/**
 * @desc Update customer info
 * @route PUT /api/customers/:id
 */
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

/**
 * @desc Adjust customer loyalty points
 * @route PATCH /api/customers/:id/loyalty
 */
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

/**
 * @desc Deactivate customer instead of deleting
 * @route PATCH /api/customers/:id/deactivate
 */
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

/**
 * @desc Permanently delete customer
 * @route DELETE /api/customers/:id
 */
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
