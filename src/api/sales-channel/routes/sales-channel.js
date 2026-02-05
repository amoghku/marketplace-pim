'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/sales-channels',
      handler: 'api::sales-channel.sales-channel.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/sales-channels/:id',
      handler: 'api::sales-channel.sales-channel.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/sales-channels',
      handler: 'api::sales-channel.sales-channel.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/sales-channels/:id',
      handler: 'api::sales-channel.sales-channel.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/sales-channels/:id',
      handler: 'api::sales-channel.sales-channel.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
