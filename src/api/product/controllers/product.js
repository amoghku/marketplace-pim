'use strict';

const { createCoreController } = require('@strapi/strapi').factories;
const { mergePopulate, MEDIA_FILE_FIELDS } = require('../../../utils/populate');

const PRODUCT_DEFAULT_POPULATE = {
	category: {
		fields: ['id', 'name', 'slug', 'workflow_status', 'visibility', 'sort_rank', 'sync_status'],
		populate: {
			parent: { fields: ['id', 'name', 'slug'] },
			children: { fields: ['id', 'name', 'slug'] },
			collections: { fields: ['id', 'name', 'slug'] },
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
		},
	},
	collections: {
		fields: ['id', 'name', 'slug', 'workflow_status', 'visibility', 'sort_rank'],
		populate: {
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
		},
	},
	media_assets: {
		populate: {
			file: { fields: MEDIA_FILE_FIELDS },
		},
	},
};

module.exports = createCoreController('api::product.product', ({ strapi }) => ({
	applyDefaultPopulate(ctx) {
		const query = ctx.query || {};
		ctx.query = {
			...query,
			populate: mergePopulate(PRODUCT_DEFAULT_POPULATE, query.populate),
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
