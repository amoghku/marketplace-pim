'use strict';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const normalizePopulateValue = (defaults, provided) => {
  if (provided === undefined || provided === null) {
    return defaults;
  }

  if (provided === '*' || provided === true) {
    return defaults !== undefined ? defaults : true;
  }

  if (!isObject(provided)) {
    return provided;
  }

  const result = {};
  const defaultKeys = isObject(defaults) ? Object.keys(defaults) : [];
  for (const key of defaultKeys) {
    result[key] = defaults[key];
  }

  for (const [key, value] of Object.entries(provided)) {
    const defaultValue = isObject(defaults) ? defaults[key] : undefined;
    result[key] = normalizePopulateValue(defaultValue, value);
  }

  return result;
};

const mergePopulate = (defaults, provided) => {
  if (provided === undefined) {
    return defaults;
  }

  if (!isObject(provided)) {
    return normalizePopulateValue(defaults, provided);
  }

  const merged = {};
  const keys = new Set([
    ...Object.keys(defaults || {}),
    ...Object.keys(provided || {}),
  ]);

  for (const key of keys) {
    const defaultValue = defaults ? defaults[key] : undefined;
    const providedValue = provided ? provided[key] : undefined;
    merged[key] = normalizePopulateValue(defaultValue, providedValue);
  }

  return merged;
};

module.exports = {
  mergePopulate,
  MEDIA_FILE_FIELDS: ['id', 'name', 'url', 'mime', 'size', 'ext'],
};
