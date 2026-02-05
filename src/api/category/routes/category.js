'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/categories',
      handler: 'api::category.category.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/categories/:id',
      handler: 'api::category.category.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/categories',
      handler: 'api::category.category.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/categories/:id',
      handler: 'api::category.category.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/categories/:id',
      handler: 'api::category.category.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
