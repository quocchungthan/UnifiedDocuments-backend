import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders GitHub-flavoured structure', () => {
    const html = renderMarkdown(
      '## Plan\n\n- [x] done\n- todo\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n`code`',
    );
    expect(html).toContain('<h2');
    expect(html).toContain('<li>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('<table>');
    expect(html).toContain('<code>code</code>');
  });

  it('escapes raw HTML from untrusted sources', () => {
    const html = renderMarkdown('hi <script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });

  it('treats empty input as empty output', () => {
    expect(renderMarkdown('').trim()).toBe('');
  });

  it('preserves chapter anchors without allowing attributes that execute code', () => {
    expect(renderMarkdown('<a id="engine"></a>\n\n## Engine')).toContain('<a id="engine"></a>');
    expect(renderMarkdown('<a id="engine" onclick="alert(1)"></a>')).not.toContain('<a ');
  });
});
