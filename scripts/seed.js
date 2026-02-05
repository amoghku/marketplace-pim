const path = require('path');
const fs = require('fs');
const { createStrapi } = require('@strapi/strapi');

let strapi;

const CONTENT_TYPES = {
  category: 'api::category.category',
  product: 'api::product.product'
};

const MAX_ROWS = Infinity;

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    return { headers: [], records: [] };
  }

  const headers = parseCSVLine(lines[0]);
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length >= headers.length) {
      const record = {};
      headers.forEach((header, index) => {
        record[header.trim()] = values[index] || '';
      });
      record._rowNumber = i + 1;
      records.push(record);
    }
  }

  return { headers, records };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

function generateSlug(str, suffix = '') {
  const baseSlug = str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);

  return suffix ? `${baseSlug}-${suffix}` : baseSlug;
}

function parsePrice(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);

  if (isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function getFieldValue(record, possibleKeys) {
  for (const key of possibleKeys) {
    if (record[key] !== undefined && record[key] !== null) {
      return String(record[key]).trim();
    }
  }
  return '';
}

const categoryCache = new Map();

async function findCategoryByName(name) {
  try {
    const results = await strapi.entityService.findMany(CONTENT_TYPES.category, {
      filters: { name: name },
      limit: 1
    });
    return results && results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error(`  [ERROR] Failed to search for category "${name}": ${error.message}`);
    return null;
  }
}

async function createCategory(name) {
  const slug = generateSlug(name);

  try {
    const created = await strapi.entityService.create(CONTENT_TYPES.category, {
      data: {
        name: name,
        slug: slug,
        workflow_status: 'approved',
        visibility: 'public',
        description: `Category for ${name} products`,
        sort_rank: categoryCache.size + 1
      }
    });
    return created;
  } catch (error) {
    console.error(`  [ERROR] Failed to create category "${name}": ${error.message}`);
    return null;
  }
}

async function getOrCreateCategory(name) {
  if (categoryCache.has(name)) {
    return categoryCache.get(name);
  }

  let category = await findCategoryByName(name);

  if (category) {
    console.log(`  [CATEGORY] Found existing: "${name}" (ID: ${category.id})`);
    categoryCache.set(name, category.id);
    return category.id;
  }

  category = await createCategory(name);

  if (category) {
    console.log(`  [CATEGORY] Created: "${name}" (ID: ${category.id})`);
    categoryCache.set(name, category.id);
    return category.id;
  }

  return null;
}

async function findProductBySlug(slug) {
  try {
    const results = await strapi.entityService.findMany(CONTENT_TYPES.product, {
      filters: { slug: slug },
      limit: 1
    });
    return results && results.length > 0 ? results[0] : null;
  } catch (error) {
    return null;
  }
}

async function createProduct(data, categoryId, rowNumber) {
  const baseSlug = generateSlug(data.title);
  let slug = baseSlug;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    const existing = await findProductBySlug(slug);

    if (!existing) {
      break;
    }

    attempts++;
    slug = generateSlug(data.title, `${Date.now()}-${attempts}`);
    console.log(`  [PRODUCT] Slug collision, trying: ${slug}`);
  }

  if (attempts >= maxAttempts) {
    console.log(`  [SKIP] Row ${rowNumber}: Could not generate unique slug after ${maxAttempts} attempts`);
    return null;
  }

  const shortDescription = data.title.substring(0, 150);
  const description = `<p>${data.title}</p>`;

  try {
    const productData = {
      title: data.title,
      slug: slug,
      default_price: data.price,
      currency: 'INR',
      short_description: shortDescription,
      description: description,
      status: 'published',
      sku: `SKU-${Date.now()}-${rowNumber}`,
      master_product_id: `MASTER-${Date.now()}-${rowNumber}`
    };

    if (categoryId) {
      productData.categories = [categoryId];
    }

    const created = await strapi.entityService.create(CONTENT_TYPES.product, {
      data: productData
    });

    return created;
  } catch (error) {
    console.error(`  [ERROR] Row ${rowNumber}: Failed to create product: ${error.message}`);
    return null;
  }
}

async function seedFromCSV(csvFilePath) {
  console.log('='.repeat(60));
  console.log('STRAPI SEED SCRIPT');
  console.log('='.repeat(60));
  console.log(`Source: ${csvFilePath}`);
  console.log(`Max rows: ${MAX_ROWS}`);
  console.log('='.repeat(60));
  console.log('');

  const { headers, records } = parseCSV(csvFilePath);

  console.log(`[INFO] CSV Headers: ${headers.join(', ')}`);
  console.log(`[INFO] Total records to process: ${records.length}`);
  console.log('');

  const stats = {
    categoriesCreated: 0,
    categoriesExisting: 0,
    productsCreated: 0,
    rowsSkipped: 0,
    errors: 0
  };

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowNumber = record._rowNumber;

    console.log(`[ROW ${rowNumber}] Processing...`);

    const category = getFieldValue(record, ['Category', 'category']);
    const productName = getFieldValue(record, ['Product Name', 'Product name', 'ProductName', 'product_name']);
    const priceRaw = getFieldValue(record, ['MRP', 'Price', 'price', 'mrp']);

    if (!category) {
      console.log(`  [SKIP] Row ${rowNumber}: Empty category`);
      stats.rowsSkipped++;
      continue;
    }

    if (!productName) {
      console.log(`  [SKIP] Row ${rowNumber}: Empty product name`);
      stats.rowsSkipped++;
      continue;
    }

    const price = parsePrice(priceRaw);

    if (price === null) {
      console.log(`  [SKIP] Row ${rowNumber}: Invalid price "${priceRaw}"`);
      stats.rowsSkipped++;
      continue;
    }

    const categoryExistedBefore = categoryCache.has(category);
    const categoryId = await getOrCreateCategory(category);

    if (!categoryId) {
      console.log(`  [SKIP] Row ${rowNumber}: Failed to get/create category`);
      stats.errors++;
      continue;
    }

    if (!categoryExistedBefore) {
      const existedInDb = (await findCategoryByName(category))?.id === categoryId;
      if (existedInDb) {
        stats.categoriesExisting++;
      } else {
        stats.categoriesCreated++;
      }
    }

    const product = await createProduct(
      { title: productName, price: price },
      categoryId,
      rowNumber
    );

    if (product) {
      console.log(`  [PRODUCT] Created: "${productName.substring(0, 50)}..." (ID: ${product.id})`);
      stats.productsCreated++;
    } else {
      stats.errors++;
    }

    console.log('');
  }

  console.log('='.repeat(60));
  console.log('SEED COMPLETE - SUMMARY');
  console.log('='.repeat(60));
  console.log(`Categories created:  ${stats.categoriesCreated}`);
  console.log(`Categories existing: ${stats.categoriesExisting}`);
  console.log(`Products created:    ${stats.productsCreated}`);
  console.log(`Rows skipped:        ${stats.rowsSkipped}`);
  console.log(`Errors:              ${stats.errors}`);
  console.log('='.repeat(60));
}

async function main() {
  const csvFilePath = process.argv[2] || path.resolve(__dirname, 'sample-products.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error(`[FATAL] CSV file not found: ${csvFilePath}`);
    console.log('');
    console.log('Usage: node seed.js [path-to-csv]');
    console.log('Example: node seed.js ./data/products.csv');
    process.exit(1);
  }

  try {
    console.log('[INFO] Bootstrapping Strapi...');

    strapi = await createStrapi({
      dir: path.resolve(__dirname, '..')
    }).load();

    console.log('[INFO] Strapi loaded successfully');
    console.log('');

    await seedFromCSV(csvFilePath);
  } catch (error) {
    console.error(`[FATAL] ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (strapi) {
      await strapi.destroy();
    }
    process.exit(0);
  }
}

main();