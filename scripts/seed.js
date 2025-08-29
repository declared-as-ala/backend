import dotenv from 'dotenv';
import mongoose from 'mongoose';
import slugify from 'slugify';
import { connectDB } from '../src/config/db.js';
import AdminUser from '../src/models/AdminUser.js';
import Category from '../src/models/Category.js';
import Product from '../src/models/Product.js';

dotenv.config();

const run = async () => {
  try {
    await connectDB();

    // ✅ Seed Admin
    const adminEmail =
      process.env.ADMIN_DEFAULT_EMAIL || 'admin@lesdelices.com';
    const adminPass = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe123!';
    const exists = await AdminUser.findOne({ email: adminEmail });

    if (!exists) {
      await AdminUser.create({
        email: adminEmail,
        password: adminPass, // ⚠️ Should be hashed in pre-save hook
        name: 'Super Admin',
        role: 'admin',
      });
      console.log(`✅ Admin created: ${adminEmail} / ${adminPass}`);
    } else {
      console.log('ℹ️ Admin already exists');
    }

    // ✅ Categories
    const categoriesData = [
      {
        name: 'Fruits De Saison',
        slug: slugify('Fruits De Saison', { lower: true }),
      },
      { name: 'Légumes', slug: slugify('Légumes', { lower: true }) },
      { name: 'Tomates', slug: slugify('Tomates', { lower: true }) },
      {
        name: 'Épicerie Fine',
        slug: slugify('Épicerie Fine', { lower: true }),
      },
      {
        name: 'Jus De Fruits',
        slug: slugify('Jus De Fruits', { lower: true }),
      },
      { name: 'Agrumes', slug: slugify('Agrumes', { lower: true }) },
      { name: 'Salades', slug: slugify('Salades', { lower: true }) },
      {
        name: 'Herbes Aromatiques',
        slug: slugify('Herbes Aromatiques', { lower: true }),
      },
      { name: 'Fruits Rouge', slug: slugify('Fruits Rouge', { lower: true }) },
      {
        name: 'Fruits Exotiques',
        slug: slugify('Fruits Exotiques', { lower: true }),
      },
      {
        name: 'Produits Laitiers',
        slug: slugify('Produits Laitiers', { lower: true }),
      },
      {
        name: 'Produits Alimentaires Variés',
        slug: slugify('Produits Alimentaires Variés', { lower: true }),
      },
    ];

    await Category.deleteMany();
    const insertedCategories = await Category.insertMany(categoriesData);
    console.log('✅ Categories seeded');

    // ✅ Create a category map for easy reference
    const categoryMap = {};
    insertedCategories.forEach((cat) => {
      categoryMap[cat.name] = cat._id;
    });

    // ✅ Products with valid category ObjectId
    await Product.deleteMany();
    await Product.insertMany([
      {
        title: 'Tomate Cœur de Bœuf',
        price: 4.99,
        category: categoryMap['Légumes'],
        image: 'https://example.com/tomate.jpg',
        stock: 50,
        description:
          'Tomates fraîches et savoureuses, idéales pour vos salades.',
      },
      {
        title: 'Orange Bio',
        price: 3.49,
        category: categoryMap['Agrumes'],
        image: 'https://example.com/orange.jpg',
        stock: 100,
        description: 'Oranges bio riches en vitamine C.',
      },
    ]);

    console.log('✅ Products seeded');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

run();
