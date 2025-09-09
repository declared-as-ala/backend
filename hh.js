import { readFileSync, writeFileSync } from "fs";
import path from "path";

// Paths
const inputFile = path.join(process.cwd(), "aa.json");
const outputFile = path.join(process.cwd(), "products_fixed.json");

// Read the JSON file
const rawData = readFileSync(inputFile, "utf-8");
let products = JSON.parse(rawData);

// Update unit_type if it's "unknown"
products = products.map((product) => {
  if (product.variants && Array.isArray(product.variants)) {
    product.variants = product.variants.map((variant) => {
      if (!variant.unit_type || variant.unit_type === "unknown") {
        return {
          ...variant,
          unit_type: "piece", // Default value
        };
      }
      return variant;
    });
  }
  return product;
});

// Save the updated data into a new JSON file
writeFileSync(outputFile, JSON.stringify(products, null, 2), "utf-8");

console.log(`✅ Products updated successfully! Saved to ${outputFile}`);
