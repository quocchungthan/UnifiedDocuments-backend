import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { CodeBlock } from './code-block';
import { Markdown } from './markdown';

afterEach(() => vi.unstubAllGlobals());

it('soft-wraps by default and toggles wrapping without changing the copy payload', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { languages: ['en'], language: 'en', clipboard: { writeText } });
  const fixture = TestBed.createComponent(CodeBlock);
  const text = 'a long logical line\nwith original indentation\n';
  fixture.componentRef.setInput('code', text);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const toggle = root.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(root.querySelector('pre')?.classList.contains('wrap')).toBe(true);
  expect(toggle.textContent?.trim()).toBe('');
  toggle.click();
  fixture.detectChanges();
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(root.querySelector('pre')?.classList.contains('wrap')).toBe(false);
  root.querySelector<HTMLButtonElement>('button[title="Copy"]')!.click();
  await fixture.whenStable();
  expect(writeText).toHaveBeenCalledWith(text);
  fixture.componentRef.setInput('wrap', false);
  fixture.detectChanges();
  toggle.click();
  fixture.detectChanges();
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  expect(root.querySelector('code')?.textContent).toBe(text);
});
it('copies exact multiline text and exposes failure instead of reporting false success', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { languages: ['en'], language: 'en', clipboard: { writeText } });
  const fixture = TestBed.createComponent(CodeBlock);
  const text = 'dotnet run --project Service\n# keep this terminal open\n';
  fixture.componentRef.setInput('code', text);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  root.querySelector<HTMLButtonElement>('button[title="Copy"]')!.click();
  await fixture.whenStable();
  expect(writeText).toHaveBeenCalledWith(text);
  expect(root.querySelector('[role=status]')?.textContent).toBe('Copied');
  fixture.componentRef.setInput('code', '<script>untrusted text</script>');
  fixture.detectChanges();
  writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
  root.querySelector<HTMLButtonElement>('button[title="Copy"]')!.click();
  await fixture.whenStable();
  expect(root.querySelector('[role=alert]')?.textContent).toContain('Could not copy');
  expect(root.querySelector('script')).toBeNull();
  expect(root.querySelector('code')?.textContent).toBe('<script>untrusted text</script>');
});

it('upgrades nested Markdown fences and replaces their copy payload when content changes', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { languages: ['en'], language: 'en', clipboard: { writeText } });
  const fixture = TestBed.createComponent(Markdown);
  fixture.componentRef.setInput(
    'text',
    '> ```sh\n> dotnet run\n> ```\n\n[Source](https://example.invalid)',
  );
  fixture.detectChanges();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const block = root.querySelector('blockquote emfc-code-block')!;
  expect(block).not.toBeNull();
  block.querySelector<HTMLButtonElement>('button[title="Copy"]')!.click();
  await fixture.whenStable();
  expect(writeText).toHaveBeenLastCalledWith('dotnet run\n');
  expect(root.querySelector('a')?.getAttribute('href')).toBe('https://example.invalid');
  fixture.componentRef.setInput('text', '```text\nreplacement\n```');
  fixture.detectChanges();
  await fixture.whenStable();
  expect(root.querySelectorAll('emfc-code-block')).toHaveLength(1);
  root.querySelector<HTMLButtonElement>('button[title="Copy"]')!.click();
  await fixture.whenStable();
  expect(writeText).toHaveBeenLastCalledWith('replacement\n');
});

it('numbers logical lines without changing text, linked parts or the clipboard payload', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { languages: ['en'], language: 'en', clipboard: { writeText } });
  const fixture = TestBed.createComponent(CodeBlock);
  const text = 'first\n\nhttps://example.com/\nlast\n';
  fixture.componentRef.setInput('code', text);
  fixture.componentRef.setInput('wrap', true);
  fixture.componentRef.setInput('parts', [
    { text: 'first\n\n' },
    { text: 'https://example.com/', href: 'https://example.com/' },
    { text: '\nlast\n' },
  ]);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelector('code')?.textContent).toBe(text);
  const numbers = [...root.querySelectorAll('.line-number')];
  expect(numbers.map((line) => line.getAttribute('data-line'))).toEqual(['1', '2', '3', '4']);
  expect(numbers.every((line) => line.getAttribute('aria-hidden') === 'true')).toBe(true);
  expect(root.querySelector('.code-line:nth-child(3) a')?.getAttribute('href')).toBe(
    'https://example.com/',
  );
  root.querySelector<HTMLButtonElement>('button[title="Copy"]')!.click();
  await fixture.whenStable();
  expect(writeText).toHaveBeenCalledWith(text);
  fixture.componentRef.setInput('parts', null);
  fixture.componentRef.setInput('code', '');
  fixture.detectChanges();
  expect(root.querySelectorAll('.line-number')).toHaveLength(1);
  expect(root.querySelector('code')?.textContent).toBe('');
});

it('links plain web and mail addresses without changing text or linking other schemes', () => {
  vi.stubGlobal('navigator', { languages: ['en'], language: 'en' });
  const fixture = TestBed.createComponent(CodeBlock);
  const text = 'Mail mailto:hi@eldervibe.dev, docs (https://eldervibe.dev/a?b=1).\njavascript:alert(1) mailto:nobody\n';
  fixture.componentRef.setInput('code', text);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.querySelector('code')?.textContent).toBe(text);
  const links = [...root.querySelectorAll('a')];
  expect(links.map((link) => link.getAttribute('href'))).toEqual([
    'mailto:hi@eldervibe.dev',
    'https://eldervibe.dev/a?b=1',
  ]);
  expect(links.map((link) => link.getAttribute('target'))).toEqual([null, '_blank']);
});
