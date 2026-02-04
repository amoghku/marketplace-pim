'use strict';

const {
  createCategoryApprovalTask,
  WORKFLOW_INTERNAL_FLAG,
} = require('../../../../utils/category-approval.js');

function ensureReadyForReview(data) {
  data.workflow_status = 'ready_for_review';
  data.sync_status = 'not_synced';
  data.sync_error = null;
}

async function loadCategoryById(id) {
  if (!id) {
    return null;
  }

  return strapi.entityService.findOne('api::category.category', id, {
    fields: [
      'id',
      'name',
      'slug',
      'description',
      'visibility',
      'workflow_status',
      'sort_rank',
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
}

module.exports = {
  async beforeCreate(event) {
    event.state = event.state || {};
    const data = event.params.data || {};
    event.params.data = data;
    ensureReadyForReview(data);
    event.state.previousCategory = null;
  },
  async afterCreate(event) {
    const categoryId = event.result?.id;
    if (!categoryId) {
      return;
    }

    try {
      const fullCategory = await loadCategoryById(categoryId);
      await createCategoryApprovalTask(strapi, {
        category: fullCategory,
        previousState: null,
      });
    } catch (error) {
      strapi.log.error(
        `[category-approval] Failed to create approval task for new category (${categoryId}): ${error.message}`
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
    event.state.previousCategory = await loadCategoryById(existingId);
  },
  async afterUpdate(event) {
    if (event.state?.skipApprovalTask) {
      return;
    }

    const categoryId = event.result?.id;
    if (!categoryId) {
      return;
    }

    try {
      const fullCategory = await loadCategoryById(categoryId);
      await createCategoryApprovalTask(strapi, {
        category: fullCategory,
        previousState: event.state?.previousCategory || null,
      });
    } catch (error) {
      strapi.log.error(
        `[category-approval] Failed to create approval task for updated category (${categoryId}): ${error.message}`
      );
    }
  },
};
