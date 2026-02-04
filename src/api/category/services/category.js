'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const medusaSyncClient = require('../../../utils/medusa-sync-client');
const { WORKFLOW_INTERNAL_FLAG } = require('../../../utils/category-approval.js');
const { normalizeValuePerPoints } = require('../../../utils/value-per-point.js');

const SYNC_DISABLED = String(process.env.MEDUSA_SYNC_DISABLED || '').toLowerCase() === 'true';

module.exports = createCoreService('api::category.category', ({ strapi }) => {
  const updateSyncState = async (id, status, errorMessage) => {
    await strapi.entityService.update('api::category.category', id, {
      data: {
        sync_status: status,
        sync_error: errorMessage,
        [WORKFLOW_INTERNAL_FLAG]: true,
      },
    });
  };

  const resolvePrimaryCollectionSlug = async (categoryId) => {
    const collections = await strapi.entityService.findMany('api::collection.collection', {
      filters: {
        categories: {
          id: categoryId,
        },
      },
      fields: ['slug', 'sort_rank'],
      sort: ['sort_rank:asc', 'name:asc'],
      limit: 1,
    });

    if (!collections || collections.length === 0) {
      return null;
    }

    return collections[0].slug || null;
  };

  const service = {};

  service.syncCategoryById = async (id) => {
    const entity = await strapi.entityService.findOne('api::category.category', id, {
      fields: [
        'id',
        'name',
        'slug',
        'description',
        'workflow_status',
        'visibility',
        'sort_rank',
        'sync_status',
      ],
      populate: {
        value_per_points: {
          fields: ['vpp'],
          populate: {
            currency: {
              fields: ['id', 'code', 'name', 'symbol'],
            },
            sales_channel: {
              fields: ['id', 'name'],
            },
          },
        },
      },
    });

    return service.syncCategory(entity);
  };

  service.syncCategory = async (category) => {
    if (!category) {
      return { ok: false, reason: 'category_not_found' };
    }

    if (!category.slug) {
      await updateSyncState(category.id, 'error', 'Missing slug');
      return { ok: false, reason: 'missing_slug' };
    }

    if (process.env.NODE_ENV !== 'production') {
      strapi.log.debug(
        `[medusa-sync] syncCategory invoked for ${category.slug} (id=${category.id}) status=${category.workflow_status} sync_status=${category.sync_status}`
      );
    }

    if (SYNC_DISABLED) {
      strapi.log.warn('[medusa-sync] Sync disabled via MEDUSA_SYNC_DISABLED flag');
      await updateSyncState(category.id, 'not_synced', 'Sync disabled');
      return { ok: false, reason: 'sync_disabled' };
    }

    if (category.workflow_status !== 'approved') {
      if (category.sync_status !== 'not_synced') {
        await updateSyncState(category.id, 'not_synced', null);
      }
      if (process.env.NODE_ENV !== 'production') {
        strapi.log.debug(
          `[medusa-sync] Skipping sync for ${category.slug} because workflow_status=${category.workflow_status}`
        );
      }
      return { ok: false, reason: 'not_approved' };
    }

    await updateSyncState(category.id, 'pending', null);

    const collectionSlug = await resolvePrimaryCollectionSlug(category.id);

    const payload = [
      {
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        rank: typeof category.sort_rank === 'number' ? category.sort_rank : 0,
        is_active: true,
        is_internal: category.visibility === 'private',
        collection_slug: collectionSlug || undefined,
        strapi_id: category.id,
        strapi_slug: category.slug,
        value_per_points: normalizeValuePerPoints(category.value_per_points),
      },
    ];

    const response = await medusaSyncClient.syncCategories(payload);

    if (response.ok) {
      await updateSyncState(category.id, 'synced', null);
      strapi.log.info(`[medusa-sync] Category synced: ${category.slug}`);
      return { ok: true, status: 'synced' };
    }

    const errorMessage = response.error || 'Failed to sync category';
    await updateSyncState(category.id, 'error', errorMessage);
    strapi.log.error(`[medusa-sync] Category sync failed (${category.slug}): ${errorMessage}`);
    return { ok: false, error: errorMessage };
  };

  return service;
});
