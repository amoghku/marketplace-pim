'use strict';

const WORKFLOW_INTERNAL_FLAG = '__collection_workflow_internal__';
const { normalizeValuePerPoints } = require('./value-per-point.js');

const COLLECTION_DIFF_FIELDS = [
  'name',
  'slug',
  'tagline',
  'description',
  'visibility',
  'sort_rank',
  'scheduled_start',
  'scheduled_end',
  'workflow_status',
  'value_per_points',
];

function serializeCollection(entity) {
  if (!entity) {
    return null;
  }

  const categories = Array.isArray(entity.categories)
    ? entity.categories.map((item) => ({
        id: item.id,
        name: item.name,
        slug: item.slug,
      }))
    : [];

  return {
    id: entity.id,
    name: entity.name || null,
    slug: entity.slug || null,
    tagline: entity.tagline || null,
    description: entity.description || null,
    visibility: entity.visibility || null,
    sort_rank: typeof entity.sort_rank === 'number' ? entity.sort_rank : null,
    scheduled_start: entity.scheduled_start || null,
    scheduled_end: entity.scheduled_end || null,
    workflow_status: entity.workflow_status || null,
    categories,
    value_per_points: normalizeValuePerPoints(entity.value_per_points),
  };
}

function isEqual(a, b) {
  if (a === b) {
    return true;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function computeCollectionDiff(previous, current) {
  const diff = {};

  for (const field of COLLECTION_DIFF_FIELDS) {
    const prevValue = previous ? previous[field] ?? null : null;
    const currValue = current ? current[field] ?? null : null;
    if (!isEqual(prevValue, currValue)) {
      diff[field] = {
        from: prevValue,
        to: currValue,
      };
    }
  }

  const prevCategories = new Map(
    (previous?.categories || []).map((item) => [item.slug || String(item.id), item])
  );
  const currCategories = new Map(
    (current?.categories || []).map((item) => [item.slug || String(item.id), item])
  );

  const added = [];
  const removed = [];

  for (const [slug, item] of currCategories.entries()) {
    if (!prevCategories.has(slug)) {
      added.push(item);
    }
  }

  for (const [slug, item] of prevCategories.entries()) {
    if (!currCategories.has(slug)) {
      removed.push(item);
    }
  }

  if (added.length > 0 || removed.length > 0) {
    diff.categories = {
      added,
      removed,
    };
  }

  return diff;
}

function hasMeaningfulChanges(diff) {
  return Object.keys(diff).length > 0;
}

function buildApprovalTaskPayload({
  collection,
  previousState,
  currentState,
  diff,
}) {
  const isNew = !previousState;
  const action = isNew ? 'Creation' : 'Update';
  const nowIso = new Date().toISOString();

  return {
    title: `${action} request: ${currentState?.name || collection.slug}`,
    workflow_status: 'pending',
    priority: 'medium',
    entity_type: 'collection',
    entity_id: String(collection.id),
    entity_preview: collection.slug,
    summary: isNew
      ? `Collection "${currentState?.name || collection.slug}" was created and awaits approval.`
      : `Collection "${currentState?.name || collection.slug}" was updated and awaits approval.`,
    context_snapshot: {
      previous: previousState,
      current: currentState,
      submitted_at: nowIso,
    },
    metadata: {
      collection_slug: collection.slug,
      collection_id: collection.id,
      submitted_at: nowIso,
    },
    state_before: previousState,
    state_after: currentState,
    diff,
    collection: collection.id,
    decision_at: null,
  };
}

async function createCollectionApprovalTask(strapi, { collection, previousState }) {
  const currentState = serializeCollection(collection);
  const prevState = previousState ? serializeCollection(previousState) : null;
  const diff = computeCollectionDiff(prevState, currentState);

  if (!hasMeaningfulChanges(diff)) {
    return null;
  }

  const payload = buildApprovalTaskPayload({
    collection,
    previousState: prevState,
    currentState,
    diff,
  });

  return strapi.entityService.create('api::approval-task.approval-task', {
    data: payload,
  });
}

async function approveCollectionFromTask(strapi, approvalTask) {
  const collection = approvalTask.collection;
  if (!collection || !collection.id) {
    return;
  }

  const collectionId = collection.id;

  await strapi.entityService.update('api::collection.collection', collectionId, {
    data: {
      workflow_status: 'approved',
      sync_status: 'pending',
      sync_error: null,
      [WORKFLOW_INTERNAL_FLAG]: true,
    },
  });

  await strapi.service('api::collection.collection').syncCollectionById(collectionId);
}

module.exports = {
  WORKFLOW_INTERNAL_FLAG,
  serializeCollection,
  computeCollectionDiff,
  createCollectionApprovalTask,
  approveCollectionFromTask,
};
