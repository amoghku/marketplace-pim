'use strict';

function coerceNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeValuePerPoints(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  const deduped = new Map();

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      continue;
    }

    const currency = entry.currency || {};
    const salesChannel = entry.sales_channel || {};
    const rawValue = coerceNumber(entry.vpp);

    const currencyCode = typeof currency.code === 'string' ? currency.code.trim() : null;
    const salesChannelId = salesChannel.id ?? null;

    if (!currencyCode || salesChannelId === null || rawValue === null) {
      continue;
    }

    const key = `${currencyCode.toUpperCase()}::${salesChannelId}`;

    deduped.set(key, {
      currency_id: currency.id ?? null,
      currency_code: currencyCode.toUpperCase(),
      currency_name: currency.name ?? null,
      currency_symbol: currency.symbol ?? null,
      sales_channel_id: salesChannelId,
      sales_channel_name: salesChannel.name ?? null,
      value: rawValue,
    });
  }

  const normalized = Array.from(deduped.values());

  normalized.sort((a, b) => {
    const currencyCompare = a.currency_code.localeCompare(b.currency_code);
    if (currencyCompare !== 0) {
      return currencyCompare;
    }
    const aChannel = String(a.sales_channel_id);
    const bChannel = String(b.sales_channel_id);
    return aChannel.localeCompare(bChannel);
  });

  return normalized;
}

module.exports = {
  normalizeValuePerPoints,
};
