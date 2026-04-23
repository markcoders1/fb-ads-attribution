/** Normalize optional values for DB columns — single definition (DRY). */

function nullableString(value) {
  return value != null ? String(value) : null;
}

module.exports = { nullableString };
