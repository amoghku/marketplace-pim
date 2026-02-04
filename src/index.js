'use strict';

async function disableMedusaWebhooks(strapi) {
  const logger = strapi.log || console;
  const modelCandidates = ['strapi::webhook', 'admin::webhook'];
  for (const model of modelCandidates) {
    try {
      const allWebhooks = await strapi.entityService.findMany(model, {
        filters: {
          isEnabled: true,
        },
        limit: -1,
      });

      const targets = (allWebhooks || []).filter((webhook) => {
        const url = typeof webhook.url === 'string' ? webhook.url : '';
        return url.includes('/hooks/strapi') || url.includes('/admin/strapi-sync');
      });

      if (!targets || targets.length === 0) {
        continue;
      }

      for (const webhook of targets) {
        await strapi.entityService.update(model, webhook.id, {
          data: { isEnabled: false },
        });
      }

      const count = targets.length;
      logger.warn(
        `[webhooks] Disabled ${count} Strapi webhook${count === 1 ? '' : 's'} targeting Medusa endpoints to avoid premature syncs.`
      );
      return;
    } catch (error) {
      // Ignore and try next model identifier
    }
  }

  logger.info('[webhooks] No Strapi → Medusa webhooks were disabled (model not found or none enabled).');
}

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    try {
      const secret =
        (process.env.MEDUSA_STRAPI_SYNC_SECRET ||
          process.env.STRAPI_SYNC_SECRET ||
          process.env.MEDUSA_SYNC_SECRET ||
          '').trim();
      const logger = strapi.log || console;
      if (secret) {
        logger.info(`[medusa-sync] Strapi bootstrap detected sync secret of length ${secret.length}`);
      } else {
        logger.warn('[medusa-sync] Strapi bootstrap did not find a Medusa sync secret; sync calls will fail.');
      }

      await disableMedusaWebhooks(strapi);
    } catch (error) {
      const logger = strapi.log || console;
      logger.error(`[webhooks] Failed to disable Medusa webhooks: ${error.message}`);
    }
  },
};
