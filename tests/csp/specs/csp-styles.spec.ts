import { expect, test } from '@playwright/test';

for (const fixture of ['snippet', 'react']) {
  test(`${fixture} viewer styles render under nonce-only style-src`, async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto(`/${fixture}.html`);
    await page.waitForFunction(() => window.__viewerReady === true);
    await page.waitForFunction(() => {
      const container = document.querySelector('embedpdf-container');
      return Boolean(container?.shadowRoot?.querySelector('img[src^="blob:"]'));
    });

    const result = await page.evaluate(() => {
      const container = document.querySelector('embedpdf-container') as HTMLElement & {
        setTheme(theme: string): void;
      };
      const root = container.shadowRoot!;
      const viewerRoot = root.querySelector('.embedpdf-snippet-root')!;
      const before = {
        sheetCount: root.adoptedStyleSheets.length,
        display: getComputedStyle(viewerRoot).display,
        background: getComputedStyle(container).getPropertyValue('--ep-background-app'),
      };

      container.setTheme('dark');

      return {
        before,
        afterSheetCount: root.adoptedStyleSheets.length,
        afterBackground: getComputedStyle(container).getPropertyValue('--ep-background-app'),
        colorScheme: container.getAttribute('data-color-scheme'),
        violations: window.__cspViolations,
      };
    });

    expect(result.before.sheetCount).toBeGreaterThanOrEqual(3);
    expect(result.before.display).toBe('flex');
    expect(result.before.background).not.toBe('');
    expect(result.afterSheetCount).toBe(result.before.sheetCount);
    expect(result.afterBackground).not.toBe(result.before.background);
    expect(result.colorScheme).toBe('dark');
    expect(
      result.violations.filter((violation) => violation.effectiveDirective.startsWith('style-src')),
    ).toEqual([]);
    expect(consoleErrors.filter((message) => message.includes('Content Security Policy'))).toEqual(
      [],
    );
  });
}
