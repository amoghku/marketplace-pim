'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/collections',
      handler: 'api::collection.collection.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/collections/:id',
      handler: 'api::collection.collection.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/collections',
      handler: 'api::collection.collection.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/collections/:id',
      handler: 'api::collection.collection.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/collections/:id',
      handler: 'api::collection.collection.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
