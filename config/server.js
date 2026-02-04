module.exports = ({ env }) => {
  const syncSecret =
    (env('MEDUSA_STRAPI_SYNC_SECRET') || env('STRAPI_SYNC_SECRET') || env('MEDUSA_SYNC_SECRET') || '').trim();

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    app: {
      keys: env.array('APP_KEYS'),
    },
    webhooks: {
      populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
      defaultHeaders: syncSecret
        ? {
            'x-sync-secret': syncSecret,
            authorization: `Bearer ${syncSecret}`,
          }
        : {},
    },
  };
};
