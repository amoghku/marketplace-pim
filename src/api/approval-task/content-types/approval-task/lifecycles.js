'use strict';

const { approveCollectionFromTask } = require('../../../../utils/collection-approval.js');
const { approveCategoryFromTask } = require('../../../../utils/category-approval.js');

async function loadApprovalTask(id) {
  if (!id) {
    return null;
  }

  return strapi.entityService.findOne('api::approval-task.approval-task', id, {
    populate: {
      collection: {
        populate: {
          categories: {
            fields: ['id', 'name', 'slug'],
          },
        },
      },
      category: {
        fields: ['id', 'name', 'slug', 'visibility', 'workflow_status', 'sort_rank'],
      },
    },
  });
}

function ensureDecisionTimestamp(data, workflowStatus) {
  if (!data) {
    return;
  }

  if ((workflowStatus === 'approved' || workflowStatus === 'rejected') && !data.decision_at) {
    data.decision_at = new Date().toISOString();
  }
}

module.exports = {
  async beforeCreate(event) {
    const data = event.params.data || {};
    if (!data.workflow_status) {
      data.workflow_status = 'pending';
    }
    if (!data.priority) {
      data.priority = 'medium';
    }
    data.decision_at = null;
  },
  async beforeUpdate(event) {
    event.state = event.state || {};
    const id = event.params?.where?.id;
    event.state.previousTask = await loadApprovalTask(id);

    const data = event.params.data || {};
    if (data.workflow_status && data.workflow_status !== 'pending') {
      ensureDecisionTimestamp(data, data.workflow_status);
    }
  },
  async afterUpdate(event) {
    const previousTask = event.state?.previousTask;
    const updatedTaskId = event.result?.id;
    if (!updatedTaskId) {
      return;
    }

    const task = await loadApprovalTask(updatedTaskId);
    if (!task) {
      return;
    }

    const transitionedToApproved =
      previousTask?.workflow_status !== 'approved' && task.workflow_status === 'approved';

    if (task.entity_type === 'collection' && transitionedToApproved) {
      try {
        await approveCollectionFromTask(strapi, task);
      } catch (error) {
        strapi.log.error(
          `[collection-approval] Failed to process approved task ${task.id}: ${error.message}`
        );
      }
    }

    if (task.entity_type === 'category' && transitionedToApproved) {
      try {
        await approveCategoryFromTask(strapi, task);
      } catch (error) {
        strapi.log.error(
          `[category-approval] Failed to process approved task ${task.id}: ${error.message}`
        );
      }
    }
  },
};
