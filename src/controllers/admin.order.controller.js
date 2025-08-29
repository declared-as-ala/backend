import Order from '../models/Order.js';
import { Parser } from 'json2csv';

export async function listOrders(req, res, next) {
  try {
    const { status, from, to, q, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (from || to)
      filter.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      };
    if (q) {
      filter.$or = [
        { 'customer.fullName': { $regex: q, $options: 'i' } },
        { 'customer.email': { $regex: q, $options: 'i' } },
        { 'customer.phone': { $regex: q, $options: 'i' } },
      ];
    }

    const docs = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Order.countDocuments(filter);
    res.json({ data: docs, page: Number(page), total });
  } catch (e) {
    next(e);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, notes } = req.body; // pending|paid|failed|cancelled
    const o = await Order.findByIdAndUpdate(
      id,
      { status, notes },
      { new: true }
    );
    if (!o) return res.status(404).json({ message: 'Not found' });
    res.json(o);
  } catch (e) {
    next(e);
  }
}

export async function exportOrdersCSV(req, res, next) {
  try {
    const docs = await Order.find().sort({ createdAt: -1 });
    const parser = new Parser({
      fields: [
        '_id',
        'status',
        'amount',
        'currency',
        'customer.fullName',
        'customer.email',
        'customer.phone',
        'createdAt',
      ],
    });
    const csv = parser.parse(docs);
    res.header('Content-Type', 'text/csv');
    res.attachment(`orders-${Date.now()}.csv`);
    return res.send(csv);
  } catch (e) {
    next(e);
  }
}
