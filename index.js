// scrape-all-categories.js
import puppeteer from 'puppeteer';
import fs from 'fs/promises';

const CATEGORIES = [
  { id: '2DEAE19B-3116-4702-BCCA-484CD95004F3', name: 'Agrumes' },
  { id: 'CCD229E9-8F4E-4655-B45C-F47FD4890A63', name: 'Épicerie Fine' },
  { id: 'CF95D19B-1FD1-4956-B932-DF70CF975600', name: 'Fruits Coupés' },
  { id: 'CACC0E15-B8C0-4DB1-94CB-0127ECB23997', name: 'Fruits De Saison' },
  { id: 'D103016F-EF44-4C34-86A8-A05F9CD28CF1', name: 'Fruits Exotiques' },
  { id: 'MERCHANTS_DEFAULT_CATEGORY', name: 'Fruits Rouge' },
  { id: 'A0A2C38C-ED40-4AB8-B938-BE374E53CB61', name: 'Fruits Secs' },
  { id: 'B3E78B0B-61B2-4400-8BF5-3364F776DE6C', name: 'Herbes Aromatiques' },
  { id: 'B912A7A6-6971-4E16-8AC9-837C10B7E148', name: 'Jus De Fruits' },
  { id: '917309D0-0F4A-4F28-8C5D-04F5DAA8221B', name: 'Légumes' },
  { id: 'FB7618C4-3C76-4859-8924-DB6C0B565372', name: 'Produits Laitiers' },
  { id: 'B922BCE1-B416-4778-A2FA-F2014E29085E', name: 'Salades' },
  { id: '6CC64B4F-5E9B-4A80-AB68-648548BB031E', name: 'Tomates' },
];

const BASE = 'https://lesdelicesduverger.com/produits';

function parsePrice(text) {
  const match = text.match(/(\d+),(\d+)\s*€/);
  return match ? parseFloat(`${match[1]}.${match[2]}`) : 0;
}

async function scrapeProduct(page, url, category, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

      return await page.evaluate((category) => {
        const title = document.querySelector('h1')?.innerText.trim() || '';
        const fullText = document.body.innerText;
        const img =
          document.querySelector('img[src*="images.sumup.com"]')?.src || '';
        const inStock = !/Épuisé/i.test(fullText);
        return {
          title,
          description: '',
          priceText: fullText,
          image: img,
          category,
          inStock,
        };
      }, category);
    } catch (err) {
      console.warn(` ⚠ Retry ${i + 1} for ${url} due to: ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  console.error(` ❌ Failed to scrape after retries: ${url}`);
  return null;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114 Safari/537.36'
  );

  const allProducts = [];

  for (const cat of CATEGORIES) {
    const categoryUrl = `${BASE}?category=${cat.id}`;
    console.log(`\nScraping Category: ${cat.name}`);
    await page.goto(categoryUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    await page.waitForSelector('a[href*="/article/"]', { timeout: 20000 });
    const productLinks = await page.$$eval('a[href*="/article/"]', (anchors) =>
      Array.from(new Set(anchors.map((a) => a.href)))
    );

    for (const url of productLinks) {
      console.log(` → Fetching product: ${url}`);
      const data = await scrapeProduct(page, url, cat.name);

      if (data) {
        allProducts.push({
          title: data.title,
          description: '',
          price: parsePrice(data.priceText),
          unit: 'kg',
          image: data.image,
          category: data.category,
          inStock: data.inStock,
        });
      }

      await new Promise((r) => setTimeout(r, 1500)); // small delay
    }
  }

  await browser.close();

  await fs.writeFile(
    'products_all_categories.json',
    JSON.stringify(allProducts, null, 2),
    'utf-8'
  );

  console.log(
    `\nDone! Scraped ${allProducts.length} products across ${CATEGORIES.length} categories.`
  );
})();
