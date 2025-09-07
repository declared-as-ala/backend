// index.js (ESM)
import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync } from "fs";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TIMEOUT = 20000;

const log = (...a) => console.log(...a);

function decodeHtmlEntities(s = "") {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function centsToEur(n) {
  if (n == null) return null;
  return Number(n) / 100;
}

function parseWeightStringToGrams(valueStr, optionName = "") {
  if (!valueStr) return null;
  const s = String(valueStr).trim().toLowerCase();
  if (/pi[eé]ce|piece|unité|unit|pcs|pc/.test(optionName + " " + s)) {
    return { grams: null, type: "piece" };
  }
  const kgMatch = s.match(/([\d.,]+)\s*kg/);
  if (kgMatch) {
    const num = parseFloat(kgMatch[1].replace(",", "."));
    if (!Number.isNaN(num)) return { grams: Math.round(num * 1000), type: "weight" };
  }
  const gMatch = s.match(/([\d.,]+)\s*g/);
  if (gMatch) {
    const num = parseFloat(gMatch[1].replace(",", "."));
    if (!Number.isNaN(num)) return { grams: Math.round(num), type: "weight" };
  }
  const numOnly = s.match(/^(\d+(?:[.,]\d+)?)$/);
  if (numOnly) {
    const num = parseFloat(numOnly[1].replace(",", "."));
    if (num >= 50) return { grams: Math.round(num), type: "weight" };
    if (num === 1) {
      if (/poids|weight/.test(optionName.toLowerCase())) {
        return { grams: 1000, type: "weight" };
      }
      return { grams: null, type: "piece" };
    }
    return { grams: Math.round(num), type: "weight" };
  }
  return { grams: null, type: "unknown" };
}

// ---------- Fetch ----------
async function fetchHtml(url) {
  try {
    const resp = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: TIMEOUT,
    });
    return resp.data;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      return null;
    }
    throw new Error(`Network error fetching ${url}: ${err.message}`);
  }
}

// ---------- Extract product links ----------
function extractProductLinksFromCategoryHtml(html, baseUrl) {
  const $ = cheerio.load(html);
  const anchors = $("a.list-product[data-selector='list-product-view'], a.list-product");
  const hrefs = new Set();
  anchors.each((i, el) => {
    const href = $(el).attr("href");
    if (href) {
      try {
        hrefs.add(new URL(href, baseUrl).href);
      } catch (e) {}
    }
  });
  if (hrefs.size === 0) {
    $("article a").each((i, el) => {
      const href = $(el).attr("href");
      if (href) hrefs.add(new URL(href, baseUrl).href);
    });
  }
  return Array.from(hrefs);
}

// ---------- Variants parsers ----------
function parseVariantsFromDataVariantsAttr(rawAttr) {
  const decoded = decodeHtmlEntities(rawAttr);
  try {
    const arr = JSON.parse(decoded);
    if (!Array.isArray(arr)) return null;
    return arr.map((v) => {
      const id = v.uuid || v.id || null;
      const name = v.name || null;
      const priceCents = v.price != null ? Number(v.price) : (v.basePrice != null ? Number(v.basePrice) : null);
      const options = Array.isArray(v.options) ? v.options.map(o => ({ name: o.name, value: o.value })) : [];
      return { id, name, priceCents, options, raw: v };
    });
  } catch (e) {
    return null;
  }
}

function parseVariantsFromSelect($) {
  const variants = [];
  $('select[data-selector^="os-theme-option"], select.properties, select').each((i, sel) => {
    $(sel).find("option").each((j, opt) => {
      const val = $(opt).attr("value") || $(opt).text();
      const priceCents = $(opt).attr("data-price") || $(opt).attr("data-price-without-currency");
      const id = $(opt).attr("value") || null;
      const label = $(opt).text() ? $(opt).text().trim() : null;
      variants.push({
        id,
        name: label || val,
        priceCents: priceCents != null ? Number(priceCents) : null,
        options: [{ name: $(sel).attr("data-property") || $(sel).attr("name") || "option", value: val }],
      });
    });
  });
  return variants.length ? variants : null;
}

function parseVariantsFromJsonLd($) {
  const out = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const txt = $(el).text();
      const obj = JSON.parse(txt);
      const items = Array.isArray(obj) ? obj : [obj];
      items.forEach(item => {
        if (item["@type"] && String(item["@type"]).toLowerCase() === "product") {
          const offers = item.offers;
          if (Array.isArray(offers)) {
            offers.forEach(o => {
              out.push({
                id: o.sku || null,
                name: o.name || null,
                priceCents: o.price ? Math.round(Number(o.price) * 100) : null,
                options: []
              });
            });
          } else if (offers && typeof offers === "object") {
            out.push({
              id: offers.sku || null,
              name: offers.name || null,
              priceCents: offers.price ? Math.round(Number(offers.price) * 100) : null,
              options: []
            });
          }
        }
      });
    } catch (e) {}
  });
  return out.length ? out : null;
}

function normalizeVariantRecords(rawVariants) {
  return rawVariants.map(v => {
    const name = v.name || (v.raw && v.raw.name) || null;
    const priceCents = v.priceCents != null ? Number(v.priceCents) : (v.raw && (v.raw.price || v.raw.basePrice) ? Number(v.raw.price || v.raw.basePrice) : null);
    const opts = v.options && v.options.length ? v.options : (v.raw && v.raw.options ? v.raw.options.map(o => ({ name: o.name, value: o.value })) : []);
    let grams = null;
    let unitType = "unknown";
    if (opts && opts.length) {
      const opt0 = opts[0];
      const parsed = parseWeightStringToGrams(opt0.value, opt0.name || "");
      if (parsed) {
        grams = parsed.grams;
        unitType = parsed.type;
      }
    }
    if (!opts.length && name) {
      const parsed2 = parseWeightStringToGrams(name, "");
      if (parsed2) {
        grams = parsed2.grams;
        unitType = parsed2.type;
      }
    }
    const priceEur = priceCents != null ? centsToEur(priceCents) : null;
    const price_per_kg = (priceEur != null && grams != null && grams > 0) ? +(priceEur * (1000/grams)).toFixed(4) : null;
    return {
      variant_id: v.id || null,
      variant_name: name,
      price_cents: priceCents,
      price_eur: priceEur,
      unit_type: unitType,
      grams,
      price_per_kg,
      options: opts
    };
  });
}

// ---------- Product page scraping ----------
async function scrapeProductPage(url) {
  const html = await fetchHtml(url);
  if (!html) return null;
  const $ = cheerio.load(html);

  // Title
  const title = $("[data-selector='os-theme-product-title']").first().text().trim()
    || $("h1.headline-large").first().text().trim()
    || $("title").text().trim();

  // Main image
  let image = "";
  const imgEl = $(".product-gallery .splide__list li a img").first();
  if (imgEl && imgEl.attr) {
    image = imgEl.attr("src") || "";
  }

  // Variants
  let dv = null;
  const selectors = [
    '#productContainer',
    'section.product-container[data-variants]',
    '[data-selector="os-theme-product"][data-variants]',
    '[data-variants]'
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el && el.attr && el.attr("data-variants")) {
      dv = el.attr("data-variants");
      break;
    }
  }

  let rawVariants = null;
  if (dv) rawVariants = parseVariantsFromDataVariantsAttr(dv);
  if (!rawVariants) {
    const selVariants = parseVariantsFromSelect($);
    if (selVariants) rawVariants = selVariants;
  }
  if (!rawVariants) {
    const ldVars = parseVariantsFromJsonLd($);
    if (ldVars) rawVariants = ldVars;
  }
  if (!rawVariants) {
    const priceEl = $("[data-selector='os-theme-product-price']").first();
    let priceCents = null;
    if (priceEl && priceEl.attr) {
      const p = priceEl.attr("data-price-without-currency");
      if (p != null) priceCents = Number(p);
      else {
        const text = priceEl.text().trim();
        const matched = text.match(/(\d+[.,]?\d*)/);
        if (matched) priceCents = Math.round(parseFloat(matched[1].replace(",", ".")) * 100);
      }
    }
    rawVariants = [{ id: null, name: null, priceCents, options: [] }];
  }

  const normalized = normalizeVariantRecords(rawVariants);

  return { url, title, image, variants: normalized, rawVariantsExist: !!dv };
}


// ---------- All categories runner ----------
const categories = [
  { name: "Argumes", url: "https://lesdelicesduverger.com/produits?category=2DEAE19B-3116-4702-BCCA-484CD95004F3" },
  { name: "Corbeille de fruit", url: "https://lesdelicesduverger.com/produits?category=6F40C208-251F-454D-A7E3-01D31494B322" },
  { name: "Épicerie Fine", url: "https://lesdelicesduverger.com/produits?category=CCD229E9-8F4E-4655-B45C-F47FD4890A63" },
  { name: "Fruits coupés", url: "https://lesdelicesduverger.com/produits?category=CF95D19B-1FD1-4956-B932-DF70CF975600" },
  { name: "Fruits De Saison", url: "https://lesdelicesduverger.com/produits?category=CACC0E15-B8C0-4DB1-94CB-0127ECB23997" },
  { name: "Fruits exotiques", url: "https://lesdelicesduverger.com/produits?category=D103016F-EF44-4C34-86A8-A05F9CD28CF1" },
  { name: "Fruits rouges", url: "https://lesdelicesduverger.com/produits?category=MERCHANTS_DEFAULT_CATEGORY" },
  { name: "Fruits secs", url: "https://lesdelicesduverger.com/produits?category=A0A2C38C-ED40-4AB8-B938-BE374E53CB61" },
  { name: "Herbes harmonique", url: "https://lesdelicesduverger.com/produits?category=B3E78B0B-61B2-4400-8BF5-3364F776DE6C" },
  { name: "Jus De Fruits", url: "https://lesdelicesduverger.com/produits?category=B912A7A6-6971-4E16-8AC9-837C10B7E148" },
  { name: "Légumes", url: "https://lesdelicesduverger.com/produits?category=917309D0-0F4A-4F28-8C5D-04F5DAA8221B" },
  { name: "Produits laitiers", url: "https://lesdelicesduverger.com/produits?category=FB7618C4-3C76-4859-8924-DB6C0B565372" },
  { name: "salades", url: "https://lesdelicesduverger.com/produits?category=B922BCE1-B416-4778-A2FA-F2014E29085E" },
  { name: "Tomates", url: "https://lesdelicesduverger.com/produits?category=6CC64B4F-5E9B-4A80-AB68-648548BB031E" },
];

async function runAllCategories() {
  const allProducts = [];
  for (const cat of categories) {
    log(`\n====== CATEGORY: ${cat.name} ======`);
    const base = new URL(cat.url).origin;
    const categoryProducts = [];
    for (let page = 1; page < 100; page++) {
      const pageUrl = `${cat.url}&page=${page}`;
      log(`Fetching page: ${pageUrl}`);
      const html = await fetchHtml(pageUrl);
      if (!html) {
        log(`Page ${page} does not exist, stopping pagination for category ${cat.name}.`);
        break;
      }
      const urls = extractProductLinksFromCategoryHtml(html, base);
      log(`Found ${urls.length} product links on page ${page}.`);
      categoryProducts.push(...urls);
      await new Promise(r => setTimeout(r, 500));
    }

    for (let i = 0; i < categoryProducts.length; i++) {
      const p = categoryProducts[i];
      try {
        log(`\n[${i + 1}/${categoryProducts.length}] Fetching product: ${p}`);
        const data = await scrapeProductPage(p);
        if (!data) continue;
        data.category = cat.name;
        allProducts.push(data);
        await new Promise(r => setTimeout(r, 750));
      } catch (e) {
        log(`Error scraping ${p}: ${e.message}`);
      }
    }
  }

  writeFileSync("all_products_with_variants.json", JSON.stringify(allProducts, null, 2), "utf-8");
  log(`\nSaved all_products_with_variants.json (${allProducts.length} products).`);
}

// Run
runAllCategories().catch(err => {
  console.error("Fatal error:", err);
  process.exit(2);
});
