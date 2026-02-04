'use strict';

const { WORKFLOW_INTERNAL_FLAG } = require('./collection-approval.js');
const { normalizeValuePerPoints } = require('./value-per-point.js');

const CATEGORY_DIFF_FIELDS = [
  'name',
  'slug',
  'description',
  'visibility',
  'sort_rank',
  'workflow_status',
  'value_per_points',
];

function serializeCategory(entity) {
  if (!entity) {
    return null;
  }

  return {
    id: entity.id,
    name: entity.name || null,
    slug: entity.slug || null,
    description: entity.description || null,
    visibility: entity.visibility || null,
    sort_rank: typeof entity.sort_rank === 'number' ? entity.sort_rank : null,
    workflow_status: entity.workflow_status || null,
    value_per_points: normalizeValuePerPoints(entity.value_per_points),
  };
}

function isEqual(a, b) {
  if (a === b) {
    return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function computeCategoryDiff(previous, current) {
  const diff = {};

  for (const field of CATEGORY_DIFF_FIELDS) {
    const prevValue = previous ? previous[field] ?? null : null;
    const currValue = current ? current[field] ?? null : null;
    if (!isEqual(prevValue, currValue)) {
      diff[field] = {
        from: prevValue,
        to: currValue,
      };
    }
  }

  return diff;
}

function hasMeaningfulChanges(diff) {
  return Object.keys(diff).length > 0;
}

function buildApprovalTaskPayload({ category, previousState, currentState, diff }) {
  const isNew = !previousState;
  const action = isNew ? 'Creation' : 'Update';
  const nowIso = new Date().toISOString();

  return {
    title: `${action} request: ${currentState?.name || category.slug}`,
    workflow_status: 'pending',
    priority: 'medium',
    entity_type: 'category',
    entity_id: String(category.id),
    entity_preview: category.slug,
    summary: isNew
      ? `Category "${currentState?.name || category.slug}" was created and awaits approval.`
      : `Category "${currentState?.name || category.slug}" was updated and awaits approval.`,
    context_snapshot: {
      previous: previousState,
      current: currentState,
      submitted_at: nowIso,
    },
    metadata: {
      category_slug: category.slug,
      category_id: category.id,
      submitted_at: nowIso,
    },
    state_before: previousState,
    state_after: currentState,
    diff,
    category: category.id,
    decision_at: null,
  };
}

async function createCategoryApprovalTask(strapi, { category, previousState }) {
  const currentState = serializeCategory(category);
  const prevState = previousState ? serializeCategory(previousState) : null;
  const diff = computeCategoryDiff(prevState, currentState);

  if (!hasMeaningfulChanges(diff)) {
    return null;
  }

  const payload = buildApprovalTaskPayload({
    category,
    previousState: prevState,
    currentState,
    diff,
  });

  return strapi.entityService.create('api::approval-task.approval-task', {
    data: payload,
  });
}

async function approveCategoryFromTask(strapi, approvalTask) {
  const category = approvalTask.category;
  if (!category || !category.id) {
    return;
  }

  const categoryId = category.id;

  await strapi.entityService.update('api::category.category', categoryId, {
    data: {
      workflow_status: 'approved',
      sync_status: 'pending',
      sync_error: null,
      [WORKFLOW_INTERNAL_FLAG]: true,
    },
  });

  await strapi.service('api::category.category').syncCategoryById(categoryId);
}

module.exports = {
  WORKFLOW_INTERNAL_FLAG,
  serializeCategory,
  computeCategoryDiff,
  createCategoryApprovalTask,
  approveCategoryFromTask,
};
