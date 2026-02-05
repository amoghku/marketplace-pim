'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { mergePopulate, MEDIA_FILE_FIELDS } = require('../../../utils/populate');

const CATEGORY_DEFAULT_POPULATE = {
	parent: { fields: ['id', 'name', 'slug'] },
	children: { fields: ['id', 'name', 'slug'] },
	collections: {
		fields: ['id', 'name', 'slug', 'workflow_status', 'visibility', 'sort_rank'],
		populate: {
			media_slots: {
				populate: {
					file: { fields: MEDIA_FILE_FIELDS },
				},
			},
		},
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
	products: {
		fields: ['id', 'title', 'slug', 'sku', 'status'],
	},
};

module.exports = createCoreController('api::category.category', ({ strapi }) => ({
	applyDefaultPopulate(ctx) {
		const query = ctx.query || {};
		ctx.query = {
			...query,
			populate: mergePopulate(CATEGORY_DEFAULT_POPULATE, query.populate),
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
