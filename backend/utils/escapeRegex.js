// Helpers for building safe, case-insensitive MongoDB regex filters from
// user input (query strings, route params, request bodies).
//
// Why this exists: passing raw user input to `new RegExp(input)` lets someone
// send characters like `.*`, `(`, `[` or `a{1,99999}`. Best case the search
// returns everything or throws a 500; worst case a crafted pattern makes the
// regex engine hang (ReDoS). Escaping first turns the input into plain text.

// Escapes every regex special character so the string is matched literally.
const escapeRegex = (value) =>
  String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "contains" match, case-insensitive. Use for search boxes / filters.
//   { name: containsRegex(search) }
const containsRegex = (value) => new RegExp(escapeRegex(String(value ?? '').trim()), 'i');

// "equals" match, case-insensitive, ignoring leading/trailing spaces on the
// stored value. Use when you want the whole field to match (e.g. project name).
//   { projectName: exactRegex(name) }
const exactRegex = (value) => new RegExp(`^\\s*${escapeRegex(String(value ?? '').trim())}\\s*$`, 'i');

module.exports = { escapeRegex, containsRegex, exactRegex };