// Code table: { sha256(SALT + NORMALIZED_CODE): speciesKey }.
// Intentionally EMPTY in this release — codes are published later in an update.
// Generate entries offline with: node tools/codegen.mjs CODE speciesKey  (PBKDF2, see lib/codes.js)
export const CODE_TABLE = Object.freeze({});
