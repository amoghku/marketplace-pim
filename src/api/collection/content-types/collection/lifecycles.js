'use strict';

const {
  createCollectionApprovalTask,
  WORKFLOW_INTERNAL_FLAG,
} = require('../../../../utils/collection-approval.js');

function ensureReadyForReview(data) {
  data.workflow_status = 'ready_for_review';
  data.sync_status = 'not_synced';
  data.sync_error = null;
}

async function loadCollectionById(id) {
  if (!id) {
    return null;
  }

  return strapi.entityService.findOne('api::collection.collection', id, {
    populate: {
      categories: {
        fields: ['id', 'name', 'slug'],
      },
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
}

module.exports = {
  async beforeCreate(event) {
    event.state = event.state || {};
    const data = event.params.data || {};
    event.params.data = data;
    ensureReadyForReview(data);
    event.state.previousCollection = null;
  },
  async afterCreate(event) {
    const collectionId = event.result?.id;
    if (!collectionId) {
      return;
    }

    try {
      const fullCollection = await loadCollectionById(collectionId);
      await createCollectionApprovalTask(strapi, {
        collection: fullCollection,
        previousState: null,
      });
    } catch (error) {
      strapi.log.error(
        `[collection-approval] Failed to create approval task for new collection (${collectionId}): ${error.message}`
      );
    }
  },
  async beforeUpdate(event) {
    event.state = event.state || {};
    const data = event.params.data || {};
    event.params.data = data;

    const isSystemUpdate = Object.prototype.hasOwnProperty.call(data, WORKFLOW_INTERNAL_FLAG);
    if (isSystemUpdate) {
      event.state.skipApprovalTask = true;
      delete data[WORKFLOW_INTERNAL_FLAG];
    } else {
      ensureReadyForReview(data);
    }
    const existingId = event.params?.where?.id;
    event.state.previousCollection = await loadCollectionById(existingId);
  },
  async afterUpdate(event) {
    if (event.state?.skipApprovalTask) {
      return;
    }

    const collectionId = event.result?.id;
    if (!collectionId) {
      return;
    }

    try {
      const fullCollection = await loadCollectionById(collectionId);
      await createCollectionApprovalTask(strapi, {
        collection: fullCollection,
        previousState: event.state?.previousCollection || null,
      });
    } catch (error) {
      strapi.log.error(
        `[collection-approval] Failed to create approval task for updated collection (${collectionId}): ${error.message}`
      );
    }
  },
};
