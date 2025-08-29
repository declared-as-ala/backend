import Order from '../models/Order.js';
import Product from '../models/Product.js';
import mongoose from 'mongoose';

export async function metrics(req, res, next) {
  try {
    const [totals] = await Order.aggregate([
      { $match: {} },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 },
        },
      },
    ]);

    const byDay = await Order.aggregate([
      { $match: { status: 'paid' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$amount' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          qty: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      { $project: { _id: 1, qty: 1, revenue: 1, title: '$product.title' } },
    ]);

    res.json({
      totals: { revenue: totals?.revenue ?? 0, orders: totals?.orders ?? 0 },
      byDay,
      topProducts,
    });
  } catch (e) {
    next(e);
  }
}
