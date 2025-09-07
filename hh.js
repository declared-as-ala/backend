import fs from 'fs';
import path from 'path';

// Paths
const inputFile = path.join(process.cwd(), 'aa.json');
const outputFile = path.join(process.cwd(), 'aa_clean.json');

// Read JSON file
const rawData = fs.readFileSync(inputFile, 'utf-8');
const products = JSON.parse(rawData);

// Clean image URLs
const cleanedProducts = products.map((product) => {
  if (product.image && typeof product.image === 'string') {
    product.image = product.image.trim();
  }
  return product;
});

// Write cleaned JSON
fs.writeFileSync(outputFile, JSON.stringify(cleanedProducts, null, 2), 'utf-8');

console.log(`Cleaned JSON saved to ${outputFile}`);
