import { parseJsonArray } from '@/lib/safe-json';

describe('parseJsonArray', () => {
  it('returns array as-is', () => {
    expect(parseJsonArray(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('parses JSON string into array', () => {
    expect(parseJsonArray('["x","y"]')).toEqual(['x', 'y']);
  });

  it('returns empty for non-array JSON', () => {
    expect(parseJsonArray('{"key":"val"}')).toEqual([]);
  });

  it('returns empty for invalid JSON string', () => {
    expect(parseJsonArray('not json')).toEqual([]);
  });

  it('returns empty for null', () => {
    expect(parseJsonArray(null)).toEqual([]);
  });

  it('returns empty for undefined', () => {
    expect(parseJsonArray(undefined)).toEqual([]);
  });

  it('returns empty for number', () => {
    expect(parseJsonArray(42)).toEqual([]);
  });
});
