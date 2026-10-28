import { jsonParts } from './json-viewer';

describe('JSON response links', () => {
  it('preserves exact JSON and only links HTTP and mailto string values', () => {
    const data = {
      'https://key.example': 'not a link key',
      url: 'https://example.com/path?q=a&b=c',
      contact: 'mailto:hi@eldervibe.dev',
      nested: ['http://localhost:5311', 'javascript:alert(1)', '<img src=x onerror=alert(1)>'],
    };
    const parts = jsonParts(data);
    expect(parts.map((part) => part.text).join('')).toBe(JSON.stringify(data, null, 2));
    expect(parts.flatMap((part) => part.href ? [part.href] : [])).toEqual([
      'https://example.com/path?q=a&b=c', 'mailto:hi@eldervibe.dev', 'http://localhost:5311',
    ]);
  });
});
