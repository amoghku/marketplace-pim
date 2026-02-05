'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { mergePopulate, MEDIA_FILE_FIELDS } = require('../../../utils/populate');

const COLLECTION_DEFAULT_POPULATE = {
	categories: {
		fields: ['id', 'name', 'slug', 'workflow_status', 'visibility', 'sort_rank'],
	},
	products: {
		fields: ['id', 'title', 'slug', 'sku', 'status'],
	},
	value_per_points: {
		fields: ['id', 'vpp'],
		populate: {
			currency: { fields: ['id', 'code', 'symbol'] },
			sales_channel: { fields: ['id', 'name'] },
		},
	},
	media_slots: {
		populate: {
			file: { fields: MEDIA_FILE_FIELDS },
		},
	},
	approval_tasks: {
		fields: ['id', 'title', 'workflow_status', 'priority'],
	},
};

module.exports = createCoreController('api::collection.collection', ({ strapi }) => ({
	applyDefaultPopulate(ctx) {
		const query = ctx.query || {};
		ctx.query = {
			...query,
			populate: mergePopulate(COLLECTION_DEFAULT_POPULATE, query.populate),
		};
	},

	async find(ctx) {
		this.applyDefaultPopulate(ctx);
		return await super.find(ctx);
	},

	async findOne(ctx) {
		this.applyDefaultPopulate(ctx);
		return await super.findOne(ctx);
	},
}));
