import { parseJsonArray } from './parse-json-array';

describe('parseJsonArray', () => {
  it('should parse valid JSON arrays', () => {
    expect(parseJsonArray('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
  });

  it('should return empty array for null', () => {
    expect(parseJsonArray(null)).toEqual([]);
  });

  it('should return empty array for undefined', () => {
    expect(parseJsonArray(undefined)).toEqual([]);
  });

  it('should return empty array for empty string', () => {
    expect(parseJsonArray('')).toEqual([]);
  });

  it('should return empty array for invalid JSON', () => {
    expect(parseJsonArray('not valid json')).toEqual([]);
  });

  it('should return empty array for non-array JSON', () => {
    expect(parseJsonArray('{"key": "value"}')).toEqual([]);
    expect(parseJsonArray('"just a string"')).toEqual([]);
    expect(parseJsonArray('42')).toEqual([]);
  });

  it('should handle empty JSON array', () => {
    expect(parseJsonArray('[]')).toEqual([]);
  });
});
