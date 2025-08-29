import Category from '../models/Category.js';

export async function createCategory(req, res, next) {
  try {
    const { name, slug } = req.body;
    const c = await Category.create({ name, slug });
    res.status(201).json(c);
  } catch (e) {
    next(e);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const c = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!c) return res.status(404).json({ message: 'Not found' });
    res.json(c);
  } catch (e) {
    next(e);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
