import type sanitizeHtmlType from 'sanitize-html';
import type { IOptions } from 'sanitize-html';

type SanitizeHtmlModule = typeof sanitizeHtmlType;

const sanitizeHtmlImport = require('sanitize-html') as SanitizeHtmlModule & {
  default?: SanitizeHtmlModule;
};

const sanitizeHtml = (sanitizeHtmlImport.default ?? sanitizeHtmlImport) as SanitizeHtmlModule;

/**
 * Strict clinical text sanitizer.
 * Strips ALL HTML tags and attributes — clinical free-text fields
 * must never contain executable markup.
 */
const STRICT_OPTIONS: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'recursiveEscape',
};

/**
 * Sanitize a clinical free-text value by stripping all HTML.
 * Returns undefined for empty/null/undefined inputs.
 */
export function sanitizeClinicalText(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;

  const cleaned = sanitizeHtml(value, STRICT_OPTIONS).trim();
  if (!cleaned) return undefined;

  return cleaned.slice(0, maxLength);
}
