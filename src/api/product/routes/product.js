'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/products',
      handler: 'api::product.product.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/products/:id',
      handler: 'api::product.product.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/products',
      handler: 'api::product.product.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/products/:id',
      handler: 'api::product.product.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/products/:id',
      handler: 'api::product.product.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
