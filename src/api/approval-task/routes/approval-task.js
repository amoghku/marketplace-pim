'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/approval-tasks',
      handler: 'api::approval-task.approval-task.find',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/approval-tasks/:id',
      handler: 'api::approval-task.approval-task.findOne',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/approval-tasks',
      handler: 'api::approval-task.approval-task.create',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/approval-tasks/:id',
      handler: 'api::approval-task.approval-task.update',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/approval-tasks/:id',
      handler: 'api::approval-task.approval-task.delete',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
