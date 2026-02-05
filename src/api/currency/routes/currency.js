'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/currencies',
      handler: 'api::currency.currency.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/currencies/:id',
      handler: 'api::currency.currency.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/currencies',
      handler: 'api::currency.currency.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/currencies/:id',
      handler: 'api::currency.currency.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/currencies/:id',
      handler: 'api::currency.currency.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
