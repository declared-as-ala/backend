import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// Path to your scraped JSON
const inputFile = path.join(process.cwd(), 'aa.json');
const outputFile = path.join(process.cwd(), 'products_model.json');

// Read JSON
const rawData = JSON.parse(readFileSync(inputFile, 'utf-8'));

// Convert function
function convertProduct(product) {
  const variants = product.variants.map(v => ({
    variant_id: v.variant_id || v.id || '', 
    variant_name: v.variant_name || v.name || '',
    price: v.price_eur != null ? v.price_eur : (v.price_cents != null ? v.price_cents / 100 : 0),
    unit_type: v.grams != null && v.grams > 0 ? 'weight' : 'piece',
    grams: v.grams || null,
    options: Array.isArray(v.options) ? v.options : [],
  }));

  return {
    url: product.url || '',
    title: product.title || '',
    image: product.image || '',          // <-- Added image field
    category: product.category || 'Uncategorized',
    rawVariantsExist: product.rawVariantsExist || false,
    variants,
  };
}

// Convert all products
const converted = rawData.map(convertProduct);

// Save to new JSON file
writeFileSync(outputFile, JSON.stringify(converted, null, 2), 'utf-8');

console.log(`Converted ${converted.length} products to model format and saved to ${outputFile}`);
