'use strict';

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::approval-task.approval-task');
