import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const testRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const publicDirectory = fileURLToPath(new URL('../public', import.meta.url));

await mkdir(publicDirectory, { recursive: true });
const snippetDirectory = `${repositoryRoot}/viewers/snippet/dist`;
const snippetScripts = (await readdir(snippetDirectory)).filter((file) => file.endsWith('.js'));

await Promise.all([
  ...snippetScripts.map((file) =>
    copyFile(`${snippetDirectory}/${file}`, `${publicDirectory}/${file}`),
  ),
  copyFile(`${repositoryRoot}/packages/pdfium/dist/pdfium.wasm`, `${publicDirectory}/pdfium.wasm`),
  copyFile(`${repositoryRoot}/viewers/snippet/demo-pdf/demo.pdf`, `${publicDirectory}/demo.pdf`),
]);

console.log(`Prepared CSP assets in ${testRoot}`);
