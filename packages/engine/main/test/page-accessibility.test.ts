import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';
import { toPageRef } from '@embedpdf/engine-core/runtime';
import { createLocalEngine } from '../src/index';

const samplePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  'examples',
  'engine-runtime-demo',
  'public',
  'sample.pdf',
);

function taggedPdf(
  content = 'BT /F1 12 Tf 20 170 Td /P <</MCID 0>> BDC (Hello tagged PDF) Tj EMC ET',
): Uint8Array {
  return pdfFromObjects([
    '<</Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R /MarkInfo <</Marked true>>>>',
    '<</Type /Pages /Kids [3 0 R] /Count 1>>',
    '<</Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> /StructParents 0>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
    '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>',
    '<</Type /StructTreeRoot /K [7 0 R] /ParentTree 8 0 R>>',
    '<</Type /StructElem /S /P /P 6 0 R /K 0 /Pg 3 0 R /Alt (Accessible paragraph)>>',
    '<</Nums [0 [7 0 R]]>>',
  ]);
}

function pdfFromObjects(objects: string[]): Uint8Array {
  let bytes = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(bytes.length);
    bytes += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = bytes.length;
  bytes += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) {
    bytes += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  bytes += `trailer\n<</Size ${objects.length + 1} /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(bytes);
}

test('page accessibility read crosses the local worker and returns PDF-space structure', async () => {
  const engine = createLocalEngine({ runtime: { prefer: 'wasm' } });
  const doc = await engine.open(
    {
      kind: 'bytes',
      id: 'page-accessibility-sample',
      bytes: new Uint8Array(await readFile(samplePath)),
    },
    { scope: ['*'] },
  );
  try {
    const snapshot = await doc.page(toPageRef(3056)).accessibility!.read();
    expect(Array.isArray(snapshot.elements)).toBe(true);
    for (const element of snapshot.elements) {
      expect(typeof element.tag).toBe('string');
      expect(Array.isArray(element.children)).toBe(true);
      expect(Array.isArray(element.textRuns)).toBe(true);
      expect(element.rect).toEqual({
        left: expect.any(Number),
        bottom: expect.any(Number),
        right: expect.any(Number),
        top: expect.any(Number),
      });
    }
  } finally {
    await doc.close();
  }
});

test('reads the tagged structure tree and its associated text across the local worker', async () => {
  const engine = createLocalEngine({ runtime: { prefer: 'wasm' } });
  const doc = await engine.open(
    {
      kind: 'bytes',
      id: 'tagged-accessibility-sample',
      bytes: taggedPdf(),
    },
    { scope: ['*'] },
  );
  try {
    const { elements } = await doc.page(toPageRef(3)).accessibility!.read();
    expect(elements).toHaveLength(1);
    expect(elements[0]).toMatchObject({
      tag: 'P',
      altText: 'Accessible paragraph',
      mcids: [0],
    });
    expect(elements[0]!.textRuns.some((run) => run.text.includes('Hello tagged PDF'))).toBe(true);
  } finally {
    await doc.close();
  }
});

test('copy-only scope does not reveal tagged run or structure bounds', async () => {
  const engine = createLocalEngine({ runtime: { prefer: 'wasm' } });
  const doc = await engine.open(
    { kind: 'bytes', id: 'copy-only-tagged', bytes: taggedPdf() },
    {
      scope: ['doc.text.copy'],
    },
  );
  try {
    const page = doc.page(toPageRef(3));
    expect((await page.text.read()).text).toContain('Hello tagged PDF');
    await expect(page.accessibility!.read()).rejects.toThrow();
    await expect(page.geometry.read()).rejects.toThrow();
  } finally {
    await doc.close();
  }
});

test('extracts tagged text baseline rotation in PDF y-up counterclockwise degrees', async () => {
  const bytes = taggedPdf(
    'BT /F1 12 Tf 0 1 -1 0 100 100 Tm /P <</MCID 0>> BDC (Rotated) Tj EMC ET',
  );
  const engine = createLocalEngine({ runtime: { prefer: 'wasm' } });
  const doc = await engine.open({ kind: 'bytes', id: 'rotated-tagged', bytes }, { scope: ['*'] });
  try {
    const { elements } = await doc.page(toPageRef(3)).accessibility!.read();
    expect(elements[0]!.textRuns[0]!.text).toBe('Rotated');
    expect(elements[0]!.textRuns[0]!.rotation).toBeCloseTo(90);
  } finally {
    await doc.close();
  }
});

test('preserves interleaved /K text and child order', async () => {
  const stream =
    'BT /F1 12 Tf 20 170 Td /P <</MCID 0>> BDC (Before ) Tj EMC ' +
    '/P <</MCID 2>> BDC (Middle) Tj EMC /P <</MCID 1>> BDC ( After) Tj EMC ET';
  const bytes = pdfFromObjects([
    '<</Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R /MarkInfo <</Marked true>>>>',
    '<</Type /Pages /Kids [3 0 R] /Count 1>>',
    '<</Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> /StructParents 0>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>',
    '<</Type /StructTreeRoot /K [7 0 R] /ParentTree 8 0 R>>',
    '<</Type /StructElem /S /P /P 6 0 R /K [0 9 0 R 1] /Pg 3 0 R>>',
    '<</Nums [0 [7 0 R 7 0 R 9 0 R]]>>',
    '<</Type /StructElem /S /Span /P 7 0 R /K 2 /Pg 3 0 R>>',
  ]);
  const engine = createLocalEngine({ runtime: { prefer: 'wasm' } });
  const doc = await engine.open({ kind: 'bytes', id: 'ordered-tagged', bytes }, { scope: ['*'] });
  try {
    const { elements } = await doc.page(toPageRef(3)).accessibility!.read();
    expect(elements).toHaveLength(1);
    const parent = elements[0]!;
    expect(parent.children).toHaveLength(1);
    expect(parent.textRuns.map((run) => run.text)).toEqual(['Before ', ' After']);
    expect(parent.children[0]!.textRuns[0]!.text).toBe('Middle');
    expect(parent.content).toEqual([
      { kind: 'text', runIndex: 0 },
      { kind: 'child', childIndex: 0 },
      { kind: 'text', runIndex: 1 },
    ]);
  } finally {
    await doc.close();
  }
});

test('does not assign a repeated MCID to multiple /K references', async () => {
  const stream = 'BT /F1 12 Tf 20 170 Td /P <</MCID 0>> BDC (Once) Tj EMC ET';
  const bytes = pdfFromObjects([
    '<</Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R /MarkInfo <</Marked true>>>>',
    '<</Type /Pages /Kids [3 0 R] /Count 1>>',
    '<</Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>>>> /StructParents 0>>',
    `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
    '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>',
    '<</Type /StructTreeRoot /K [7 0 R] /ParentTree 8 0 R>>',
    '<</Type /StructElem /S /P /P 6 0 R /K [0 0] /Pg 3 0 R /Alt (Repeated reference)>>',
    '<</Nums [0 [7 0 R]]>>',
  ]);
  const engine = createLocalEngine({ runtime: { prefer: 'wasm' } });
  const doc = await engine.open({ kind: 'bytes', id: 'repeated-mcid', bytes }, { scope: ['*'] });
  try {
    const { elements } = await doc.page(toPageRef(3)).accessibility!.read();
    expect(elements).toHaveLength(1);
    expect(elements[0]!.altText).toBe('Repeated reference');
    expect(elements[0]!.textRuns).toEqual([]);
    expect(elements[0]!.content).toEqual([]);
  } finally {
    await doc.close();
  }
});

test('does not associate one MCID with both page and Form XObject structure nodes', async () => {
  const pageStream = 'BT /F1 12 Tf 20 170 Td /P <</MCID 0>> BDC (Page text) Tj EMC ET /Fm1 Do';
  const formStream = 'BT /F1 12 Tf 20 20 Td /P <</MCID 0>> BDC (Form text) Tj EMC ET';
  const bytes = pdfFromObjects([
    '<</Type /Catalog /Pages 2 0 R /StructTreeRoot 6 0 R /MarkInfo <</Marked true>>>>',
    '<</Type /Pages /Kids [3 0 R] /Count 1>>',
    '<</Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R /Resources <</Font <</F1 5 0 R>> /XObject <</Fm1 9 0 R>>>> /StructParents 0>>',
    `<</Length ${pageStream.length}>>\nstream\n${pageStream}\nendstream`,
    '<</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>',
    '<</Type /StructTreeRoot /K [7 0 R 8 0 R] /ParentTree 10 0 R>>',
    '<</Type /StructElem /S /P /P 6 0 R /K 0 /Pg 3 0 R>>',
    '<</Type /StructElem /S /P /P 6 0 R /K <</Type /MCR /MCID 0 /Stm 9 0 R /Pg 3 0 R>> /Pg 3 0 R>>',
    `<</Type /XObject /Subtype /Form /BBox [0 0 100 100] /Resources <</Font <</F1 5 0 R>>>> /StructParents 1 /Length ${formStream.length}>>\nstream\n${formStream}\nendstream`,
    '<</Nums [0 [7 0 R] 1 [8 0 R]]>>',
  ]);
  const engine = createLocalEngine({ runtime: { prefer: 'wasm' } });
  const doc = await engine.open(
    { kind: 'bytes', id: 'duplicate-mcid-streams', bytes },
    { scope: ['*'] },
  );
  try {
    expect((await doc.page(toPageRef(3)).text.read()).text).toContain('Form text');
    const { elements } = await doc.page(toPageRef(3)).accessibility!.read();
    // PDFium's per-page tree may omit the Form's /StructParents entry. Even
    // when it does, its same-numbered MCID must never contaminate page runs.
    expect(elements.length).toBeGreaterThan(0);
    expect(elements.flatMap((element) => element.textRuns).map((run) => run.text)).not.toContain(
      'Form text',
    );
  } finally {
    await doc.close();
  }
});
