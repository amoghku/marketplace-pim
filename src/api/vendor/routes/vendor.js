'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/vendors',
      handler: 'api::vendor.vendor.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/vendors/:id',
      handler: 'api::vendor.vendor.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/vendors',
      handler: 'api::vendor.vendor.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/vendors/:id',
      handler: 'api::vendor.vendor.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/vendors/:id',
      handler: 'api::vendor.vendor.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
