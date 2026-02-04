'use strict';

let loggedConfig = false;

function getLogger() {
  return (globalThis.strapi && globalThis.strapi.log) || console;
}

const DEFAULT_TIMEOUT_MS = 10000;

function getBaseUrl() {
  const envUrl = process.env.MEDUSA_BACKEND_URL || process.env.MEDUSA_BASE_URL || process.env.MEDUSA_API_URL;
  const fallback = 'http://localhost:9000';
  const configured = envUrl && envUrl.trim().length > 0 ? envUrl.trim() : fallback;
  return configured.replace(/\/$/, '');
}

function getSecret() {
  const rawSecret =
    process.env.MEDUSA_STRAPI_SYNC_SECRET ||
    process.env.STRAPI_SYNC_SECRET ||
    process.env.MEDUSA_SYNC_SECRET ||
    '';

  return rawSecret
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)[0] || '';
}

async function postToMedusa(resource, payload) {
  const secret = getSecret();
  const logger = getLogger();

  if (!secret) {
    if (process.env.NODE_ENV !== 'production' && !loggedConfig) {
      loggedConfig = true;
      logger.warn('[medusa-sync] Missing sync secret configuration; skipping Medusa sync calls.');
    }
    return {
      ok: false,
      status: 0,
      error: 'Missing MEDUSA_STRAPI_SYNC_SECRET configuration',
    };
  }

  const url = `${getBaseUrl()}/admin/strapi-sync/${resource}`;

  if (!loggedConfig) {
    loggedConfig = true;
    logger.info(
      `[medusa-sync] Configured Medusa sync target → baseUrl=${getBaseUrl()}, secretLength=${secret.length}`
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const bodyPayload = {
      ...payload,
      __sync_secret: secret,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-sync-secret': secret,
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(bodyPayload),
      signal: controller.signal,
    });

    const body = await safeParseJson(response);

    if (!response.ok) {
      logger.warn(
        `[medusa-sync] Request to ${resource} sync failed (${response.status}). Headers sent: x-sync-secret, authorization`
      );
      return {
        ok: false,
        status: response.status,
        error: body?.error || `Request failed with status ${response.status}`,
        details: body,
      };
    }

    return {
      ok: true,
      status: response.status,
      body,
    };
  } catch (error) {
    logger.error(`[medusa-sync] Request to ${resource} sync threw error: ${error.message}`);
    return {
      ok: false,
      status: 0,
      error: error.name === 'AbortError' ? 'Medusa sync timed out' : error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

module.exports = {
  async syncCollections(items) {
    return postToMedusa('collections', { items });
  },
  async syncCategories(items) {
    return postToMedusa('categories', { items });
  },
};
