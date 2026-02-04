'use strict';

const { createCoreService } = require('@strapi/strapi').factories;
const medusaSyncClient = require('../../../utils/medusa-sync-client');
const { WORKFLOW_INTERNAL_FLAG } = require('../../../utils/collection-approval.js');
const { normalizeValuePerPoints } = require('../../../utils/value-per-point.js');

const SYNC_DISABLED = String(process.env.MEDUSA_SYNC_DISABLED || '').toLowerCase() === 'true';

module.exports = createCoreService('api::collection.collection', ({ strapi }) => {
  const updateSyncState = async (id, status, errorMessage) => {
    await strapi.entityService.update('api::collection.collection', id, {
      data: {
        sync_status: status,
        sync_error: errorMessage,
        [WORKFLOW_INTERNAL_FLAG]: true,
      },
    });
  };

  const service = {};

  service.syncCollectionById = async (id) => {
    const entity = await strapi.entityService.findOne('api::collection.collection', id, {
      fields: ['id', 'name', 'slug', 'visibility', 'workflow_status', 'sort_rank', 'sync_status'],
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

    return service.syncCollection(entity);
  };

  service.syncCollection = async (collection) => {
    if (!collection) {
      return { ok: false, reason: 'collection_not_found' };
    }

    if (!collection.slug) {
      await updateSyncState(collection.id, 'error', 'Missing slug');
      return { ok: false, reason: 'missing_slug' };
    }

    if (process.env.NODE_ENV !== 'production') {
      strapi.log.debug(
        `[medusa-sync] syncCollection invoked for ${collection.slug} (id=${collection.id}) status=${collection.workflow_status} sync_status=${collection.sync_status}`
      );
    }

    if (SYNC_DISABLED) {
      strapi.log.warn('[medusa-sync] Sync disabled via MEDUSA_SYNC_DISABLED flag');
      await updateSyncState(collection.id, 'not_synced', 'Sync disabled');
      return { ok: false, reason: 'sync_disabled' };
    }

    if (collection.workflow_status !== 'approved') {
      if (collection.sync_status !== 'not_synced') {
        await updateSyncState(collection.id, 'not_synced', null);
      }
      if (process.env.NODE_ENV !== 'production') {
        strapi.log.debug(
          `[medusa-sync] Skipping sync for ${collection.slug} because workflow_status=${collection.workflow_status}`
        );
      }
      return { ok: false, reason: 'not_approved' };
    }

    await updateSyncState(collection.id, 'pending', null);

    const payload = [
      {
        title: collection.name,
        slug: collection.slug,
        order: typeof collection.sort_rank === 'number' ? collection.sort_rank : 0,
        visibility: collection.visibility || 'public',
        strapi_id: collection.id,
        strapi_slug: collection.slug,
        value_per_points: normalizeValuePerPoints(collection.value_per_points),
      },
    ];

    const response = await medusaSyncClient.syncCollections(payload);

    if (response.ok) {
      await updateSyncState(collection.id, 'synced', null);
      strapi.log.info(`[medusa-sync] Collection synced: ${collection.slug}`);
      return { ok: true, status: 'synced' };
    }

    const errorMessage = response.error || 'Failed to sync collection';
    await updateSyncState(collection.id, 'error', errorMessage);
    strapi.log.error(`[medusa-sync] Collection sync failed (${collection.slug}): ${errorMessage}`);
    return { ok: false, error: errorMessage };
  };

  return service;
});
