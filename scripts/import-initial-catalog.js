'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const slugify = require('slugify');
const { createStrapi } = require('@strapi/strapi');
const { WORKFLOW_INTERNAL_FLAG } = require('../src/utils/collection-approval.js');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const COLLECTION_PIVOT_PATH = path.join(ROOT_DIR, 'Marketplace - All Products(pivot).csv');
const PRODUCTS_PATH = path.join(ROOT_DIR, 'Marketplace - All Products(All Product List).csv');
const MAX_PRODUCTS = 100;

function readCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function isTotalRow(value) {
  if (!value) {
    return false;
  }
  return value.toLowerCase().includes('total');
}

function buildCollectionAndCategoryPlan(records) {
  const collections = new Map();
  const categories = [];
  let currentCollection = null;
  let collectionOrder = 1;
  const categoryOrderByCollection = new Map();

  for (const row of records) {
    const rawCollection = (row['Category'] || '').trim();
    const rawSubCategory = (row['Sub Category'] || '').trim();

    if (rawCollection) {
      if (isTotalRow(rawCollection)) {
        currentCollection = null;
      } else {
        currentCollection = rawCollection;
        const collectionSlug = slugify(currentCollection, { lower: true, strict: true });
        if (!collections.has(collectionSlug)) {
          collections.set(collectionSlug, {
            name: currentCollection,
            slug: collectionSlug,
            order: collectionOrder++,
            categories: [],
          });
          categoryOrderByCollection.set(collectionSlug, 1);
        }
      }
    }

    if (!currentCollection) {
      continue;
    }

    if (!rawSubCategory || isTotalRow(rawSubCategory)) {
      continue;
    }

    const collectionSlug = slugify(currentCollection, { lower: true, strict: true });
    const categorySlug = slugify(`${currentCollection} ${rawSubCategory}`, {
      lower: true,
      strict: true,
    });

    if (!categorySlug) {
      continue;
    }

    const categoryKey = `${collectionSlug}::${categorySlug}`;
    const existing = categories.find((item) => item.key === categoryKey);
    if (existing) {
      continue;
    }

    const order = categoryOrderByCollection.get(collectionSlug) || 1;
    categories.push({
      key: categoryKey,
      name: rawSubCategory,
      slug: categorySlug,
      collectionSlug,
      order,
    });
    categoryOrderByCollection.set(collectionSlug, order + 1);
    const collection = collections.get(collectionSlug);
    if (collection) {
      collection.categories.push(categorySlug);
    }
  }

  return { collections, categories };
}

function generateSku(brand, productName) {
  const hash = crypto
    .createHash('md5')
    .update(`${brand}-${productName}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
  const base = slugify(`${brand}-${productName}`, {
    lower: false,
    strict: true,
    replacement: '',
  }).toUpperCase();
  return `${base.slice(0, 12)}-${hash}`;
}

function truncate(value, maxLength) {
  if (!value) {
    return value;
  }
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function createBoundedSlug(text, maxLength = 200) {
  const base = slugify(text, { lower: true, strict: true });
  if (base.length <= maxLength) {
    return base;
  }
  const hash = crypto.createHash('md5').update(text).digest('hex').slice(0, 6);
  const trimmed = base.slice(0, Math.max(maxLength - hash.length - 1, 1));
  return `${trimmed}-${hash}`;
}

function generateMasterProductId(brand, productName) {
  const hash = crypto.createHash('md5').update(`${brand}-${productName}`).digest('hex').slice(0, 10).toUpperCase();
  return `MP-${hash}`;
}

function createPlaceholderSeed(value) {
  if (value) {
    return crypto.createHash('md5').update(value).digest('hex');
  }
  return `fallback-${Date.now()}`;
}

async function fetchProductImageBuffer({ sku, productName }) {
  const seed = createPlaceholderSeed(sku || productName || 'product');
  const labelSource = productName || sku || 'Product Image';
  const label = encodeURIComponent(labelSource.slice(0, 32));
  const url = `https://placehold.co/800x600/png?text=${label}&random=${seed}`;

  const response = await fetch(url, {
    redirect: 'follow',
  });

  if (!response.ok) {
    throw new Error(`Placeholder service returned ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'image/png';
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    contentType,
    size: buffer.length,
  };
}

async function ensureCollection(strapi, data) {
  const existing = await strapi.entityService.findMany('api::collection.collection', {
    filters: { slug: data.slug },
    limit: 1,
  });

  if (existing.length > 0) {
    return {
      record: existing[0],
      created: false,
    };
  }

  const record = await strapi.entityService.create('api::collection.collection', {
    data: {
      name: data.name,
      slug: data.slug,
      tagline: `Discover ${data.name}`,
      description: `Curated assortment of ${data.name} products for the Reward360 marketplace.`,
      workflow_status: 'ready_for_review',
      visibility: 'public',
      sort_rank: data.order,
      sync_status: 'not_synced',
      external_reference: data.slug,
    },
  });

  return {
    record,
    created: true,
  };
}

async function ensureCategory(strapi, data) {
  const existing = await strapi.entityService.findMany('api::category.category', {
    filters: { slug: data.slug },
    limit: 1,
  });

  if (existing.length > 0) {
    return {
      record: existing[0],
      created: false,
    };
  }

  const record = await strapi.entityService.create('api::category.category', {
    data: {
      name: data.name,
      slug: data.slug,
      workflow_status: 'approved',
      visibility: 'public',
      description: `Products listed under ${data.name}`,
      sort_rank: data.order,
      sync_status: 'not_synced',
      external_reference: data.slug,
    },
  });

  return {
    record,
    created: true,
  };
}

async function attachCategoriesToCollections(strapi, collectionsMap, categoryIndex) {
  for (const collectionData of collectionsMap.values()) {
    const collectionRecord = collectionData.record;
    const categoryIds = [];
    for (const categorySlug of collectionData.categories) {
      const categoryKey = `${collectionData.slug}::${categorySlug}`;
      const entry = categoryIndex.get(categoryKey);
      if (entry) {
        categoryIds.push(entry.id);
      }
    }

    if (categoryIds.length === 0) {
      continue;
    }

    await strapi.entityService.update('api::collection.collection', collectionRecord.id, {
      data: {
        categories: {
          set: categoryIds.map((id) => ({ id })),
        },
        [WORKFLOW_INTERNAL_FLAG]: true,
      },
    });
  }
}

async function uploadProductImage(strapi, { buffer, contentType, size }, fileName, altText) {
  const uploadService = strapi.plugin('upload').service('upload');
  const uploadedFiles = await uploadService.upload({
    data: {
      fileInfo: {
        name: fileName,
        alternativeText: altText,
        caption: altText,
      },
    },
    files: {
      buffer,
      size,
      type: contentType,
      name: fileName,
    },
  });

  if (!uploadedFiles || uploadedFiles.length === 0) {
    throw new Error('Upload service did not return a file');
  }

  return uploadedFiles[0];
}

async function importCollectionsAndCategories(strapi) {
  console.log('Loading collection & category data...');
  const pivotRecords = readCsv(COLLECTION_PIVOT_PATH);
  const { collections, categories } = buildCollectionAndCategoryPlan(pivotRecords);

  const collectionIndex = new Map();
  for (const collectionData of collections.values()) {
    const { record, created } = await ensureCollection(strapi, collectionData);
    collectionIndex.set(collectionData.slug, {
      ...collectionData,
      record,
      created,
    });
    const action = created ? 'created' : 'unchanged';
    console.log(`✔ Collection ${action}: ${collectionData.name}`);
  }

  const categoryIndex = new Map();
  for (const categoryData of categories) {
    const { record, created } = await ensureCategory(strapi, categoryData);
    categoryIndex.set(`${categoryData.collectionSlug}::${categoryData.slug}`, record);
    const action = created ? 'created' : 'unchanged';
    console.log(
      `  ↳ Category ${action}: ${categoryData.name} (Collection: ${categoryData.collectionSlug})`
    );
  }

  await attachCategoriesToCollections(strapi, collectionIndex, categoryIndex);
  console.log('Collections and categories synchronized.');

  return {
    collectionIndex,
    categoryIndex,
  };
}

function parseProductNumber(value) {
  if (!value) {
    return null;
  }
  const sanitized = String(value).replace(/[^0-9.]/g, '');
  if (!sanitized) {
    return null;
  }
  return Number.parseFloat(sanitized);
}

async function importProducts(strapi, collectionIndex, categoryIndex) {
  console.log(`Loading first ${MAX_PRODUCTS} products...`);
  const productRecords = readCsv(PRODUCTS_PATH);
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of productRecords) {
    if (imported >= MAX_PRODUCTS) {
      break;
    }

    const collectionName = (record['Category'] || '').trim();
    const categoryName = (record['Sub Category'] || '').trim();
    const brandName = (record['Brand Name'] || '').trim();
    const productName = (record['Product Name'] || '').trim();

    if (!collectionName || !categoryName || !productName) {
      skipped += 1;
      continue;
    }

    const collectionSlug = slugify(collectionName, { lower: true, strict: true });
    const categorySlug = slugify(`${collectionName} ${categoryName}`, {
      lower: true,
      strict: true,
    });
    const categoryKey = `${collectionSlug}::${categorySlug}`;

    const collectionEntry = collectionIndex.get(collectionSlug);
    const categoryEntry = categoryIndex.get(categoryKey);

    if (!collectionEntry || !categoryEntry) {
      console.warn(`⚠️ Missing taxonomy for product: ${productName} (Collection: ${collectionName}, Category: ${categoryName})`);
      skipped += 1;
      continue;
    }

    const sku = generateSku(brandName, productName);
    const productSlug = createBoundedSlug(`${brandName} ${productName}`);

    const existing = await strapi.entityService.findMany('api::product.product', {
      filters: { sku },
      limit: 1,
      populate: ['media_assets', 'media_assets.file'],
    });
    const existingProduct = existing[0];

    if (existingProduct) {
      const hasMedia = Array.isArray(existingProduct.media_assets) && existingProduct.media_assets.length > 0;
      if (hasMedia) {
        console.log(`ℹ️ Product already exists with media, skipping: ${productName}`);
        skipped += 1;
        continue;
      }

      let mediaAssetsUpdate = [];
      try {
        const imageData = await fetchProductImageBuffer({
          sku,
          productName,
        });
        const uploaded = await uploadProductImage(
          strapi,
          imageData,
          `${productSlug}.jpg`,
          `${productName} by ${brandName}`
        );
        mediaAssetsUpdate = [
          {
            __component: 'media.asset-slot',
            source_type: 'master',
            position: 1,
            file: uploaded.id,
            alt_text: `${productName} product image`,
          },
        ];
      } catch (error) {
        console.warn(`⚠️ Unable to fetch image for existing product ${productName}: ${error.message}`);
      }

      if (mediaAssetsUpdate.length === 0) {
        console.warn(`⚠️ Skipping update because no media could be attached: ${productName}`);
        skipped += 1;
        continue;
      }

      await strapi.entityService.update('api::product.product', existingProduct.id, {
        data: {
          media_assets: mediaAssetsUpdate,
          last_synced_at: new Date().toISOString(),
        },
      });

      updated += 1;
      console.log(`✔ Added media to existing product (${updated}): ${productName}`);
      continue;
    }

    let mediaAssets = [];
    try {
      const imageData = await fetchProductImageBuffer({
        sku,
        productName,
      });
      const uploaded = await uploadProductImage(
        strapi,
        imageData,
        `${productSlug}.jpg`,
        `${productName} by ${brandName}`
      );
      mediaAssets = [
        {
          __component: 'media.asset-slot',
          source_type: 'master',
          position: 1,
          file: uploaded.id,
          alt_text: `${productName} product image`,
        },
      ];
    } catch (error) {
      console.warn(`⚠️ Unable to fetch image for ${productName}: ${error.message}`);
    }

    const now = new Date();
    const comments = (record['Comments'] || '').trim();
    const shortDescription = brandName ? `${brandName} ${productName}` : productName;
    const descriptionText = comments || shortDescription;
    const titleText = truncate(productName, 250);
    const masterProductId = generateMasterProductId(brandName, productName);

    const productData = {
      title: titleText,
      slug: productSlug,
      sku,
      status: 'pending_review',
      short_description: shortDescription,
      description: descriptionText,
      default_price: parseProductNumber(record['NLC R360 WH']) ?? undefined,
      compare_at_price: parseProductNumber(record['MRP']) ?? undefined,
      currency: 'INR',
      tax_class: 'standard',
      options: [],
      variant_blueprints: [],
      category: categoryEntry.id,
      collections: {
        connect: [{ id: collectionEntry.record.id }],
      },
      tags: [brandName, collectionName, categoryName].filter(Boolean),
      master_product_id: masterProductId,
      last_synced_at: now.toISOString(),
      notes_for_reviewer: comments || 'Imported from initial catalogue sheet.',
    };

    if (mediaAssets.length > 0) {
      productData.media_assets = mediaAssets;
    }

    await strapi.entityService.create('api::product.product', {
      data: productData,
    });

    imported += 1;
    console.log(`✔ Product imported (${imported}/${MAX_PRODUCTS}): ${productName}`);
  }

  console.log(`Product import complete. Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`);
}

async function run() {
  console.log('Bootstrapping Strapi application...');
  const strapi = await createStrapi();
  await strapi.load();

  let exitCode = 0;
  try {
    const { collectionIndex, categoryIndex } = await importCollectionsAndCategories(strapi);
    await importProducts(strapi, collectionIndex, categoryIndex);
  } catch (error) {
    console.error('Import failed:', error);
    exitCode = 1;
  } finally {
    await strapi.destroy();
    console.log('Strapi connection closed.');
    process.exit(exitCode);
  }
}

run();
