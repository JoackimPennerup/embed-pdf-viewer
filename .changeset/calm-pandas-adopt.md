---
'@embedpdf/utils': patch
'@embedpdf/plugin-ui': patch
'@embedpdf/snippet': patch
---

Use constructed stylesheets for generated viewer, plugin UI, and theme CSS so strict Content Security Policy integrations no longer require unsafe inline stylesheets.
