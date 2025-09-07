// convert_to_products_json.js
import { readFileSync, writeFileSync } from "fs";
import { v4 as uuidv4 } from "uuid";

const inputFile = "aa.json";
const outputFile = "products.json";

const rawData = JSON.parse(readFileSync(inputFile, "utf-8"));

const cleanProducts = rawData.map(p => {
  const now = new Date().toISOString();

  const variants = (p.variants || []).map(v => ({
    variant_id: v.variant_id || uuidv4(),
    variant_name: v.variant_name || "",
    price: v.price_eur || 0,
    unit_type: v.unit_type || "weight",
    grams: v.grams != null ? v.grams : null,
    options: v.options || []
  }));

  return {
    id: uuidv4(), // unique product id
    Image: (p.image || "").trim(),
    title: p.title || "",
    category: p.category || "Uncategorized",
    description: p.description || "",
    variants,
    createdAt: now,
    updatedAt: now
  };
});

writeFileSync(outputFile, JSON.stringify(cleanProducts, null, 2), "utf-8");
console.log(`Saved ${cleanProducts.length} products to ${outputFile}`);
