const mongoose = require('mongoose');
const AppError = require('./AppError');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const isEmail = (value) => typeof value === 'string' && EMAIL_RE.test(value.trim());

// At least 8 characters, with at least one letter and one number.
const isStrongPassword = (value) =>
  typeof value === 'string' && value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === String(id);

function assertValidId(id, label = 'id') {
  if (!isValidId(id)) throw new AppError(400, `Invalid ${label}.`);
}

/** Trims a string and limits its length. Returns undefined for empty input. */
function cleanString(value, max = 500) {
  if (value === undefined || value === null) return undefined;
  const str = String(value).trim();
  if (!str) return undefined;
  return str.slice(0, max);
}

/** Accepts an array or a comma-separated string and returns unique trimmed strings. */
function toStringArray(value, maxItems = 50, maxLength = 60) {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  const seen = new Set();
  const result = [];
  for (const item of list) {
    const str = String(item).trim().slice(0, maxLength);
    const key = str.toLowerCase();
    if (str && !seen.has(key)) {
      seen.add(key);
      result.push(str);
    }
    if (result.length >= maxItems) break;
  }
  return result;
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

/** Throws a 400 error listing every problem if the errors object is not empty. */
function throwIfErrors(errors) {
  if (Object.keys(errors).length) {
    throw new AppError(400, 'Please correct the highlighted fields.', errors);
  }
}

const isUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

module.exports = {
  isEmail,
  isStrongPassword,
  isValidId,
  assertValidId,
  cleanString,
  toStringArray,
  toNumber,
  throwIfErrors,
  isUrl,
};
