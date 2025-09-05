import Customer from "../../models/Customer.js";

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page) || 1, 1);
  const limit = Math.min(parseInt(query.limit) || 20, 100);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

const pickPublic = (customer) => ({
  id: customer._id.toString(),
  firstName: customer.firstName,
  lastName: customer.lastName,
  email: customer.email,
  phone: customer.phone,
  active: customer.active,
  loyaltyPoints: customer.loyaltyPoints,
  createdAt: customer.createdAt,
});

/**
 * @desc List customers with search, active filter, pagination
 * @route GET /api/admin/customers?search=&active=&page=&limit=
 */
export const listCustomers = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const search = req.query.search?.trim();
    const active = req.query.active;

    const filter = {};

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
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

/**
 * @desc Get single customer by ID
 * @route GET /api/admin/customers/:id
 */
export const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    res.json({ success: true, data: pickPublic(customer) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Create a new customer
 * @route POST /api/admin/customers
 */
export const createCustomer = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, active } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email & password required" });

    const exists = await Customer.findOne({ email: email.toLowerCase().trim() });
    if (exists)
      return res.status(409).json({ message: "Email already registered" });

    const customer = await Customer.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      active,
    });

    res.status(201).json({ success: true, data: pickPublic(customer) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc Update customer info
 * @route PUT /api/admin/customers/:id
 */
export const updateCustomer = async (req, res) => {
  try {
    const { firstName, lastName, phone, active } = req.body;

    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    if (typeof firstName === "string") customer.firstName = firstName;
    if (typeof lastName === "string") customer.lastName = lastName;
    if (typeof phone === "string") customer.phone = phone;
    if (typeof active === "boolean") customer.active = active;

    await customer.save();
    res.json({ success: true, data: pickPublic(customer) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc Adjust loyalty points (+/-)
 * @route PATCH /api/admin/customers/:id/loyalty
 */
export const adjustLoyalty = async (req, res) => {
  try {
    const { delta } = req.body;
    if (typeof delta !== "number")
      return res.status(400).json({ message: "delta must be a number" });

    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    customer.loyaltyPoints = Math.max(0, (customer.loyaltyPoints || 0) + delta);
    await customer.save();

    res.json({ success: true, data: pickPublic(customer) });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * @desc Deactivate customer (soft delete)
 * @route PATCH /api/admin/customers/:id/deactivate
 */
export const deactivateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    customer.active = false;
    await customer.save();

    res.json({ success: true, data: pickPublic(customer) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * @desc Hard delete customer (admin-only)
 * @route DELETE /api/admin/customers/:id
 */
export const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    await Customer.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Customer deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
