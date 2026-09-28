# @embedpdf/plugin-a11y

Document-scoped accessibility data for EmbedPDF v3. Install `a11yPlugin()` in the
kernel and resolve `A11yToken`. `getPageData(pageRef)` returns a tagged semantic
tree when the engine exposes `PageHandle.accessibility.read()`; otherwise, it
combines the engine's character-ordered text and geometry into fallback lines.
It never invents PDF structure for untagged documents.

`A11yPageData.elements` contains semantic HTML-ready nodes. Rectangles and
fragment `left`, `top`, `width`, and `fontHeight` use unscaled, crop-relative,
y-down **content** coordinates. Pass positions through the page view's
`transform.toPixels` to render. Fragment `rotation` is degrees clockwise in
content space; width/height are the local text extent before rotation.
When a tagged node has `content`, render its indexed `textRuns` and `children`
in that `/K` sequence instead of grouping all runs ahead of all children.
Text runs preserve their source boundaries; spaces come only from PDF text,
not from visual distance or separate text objects. A `Document` wrapper is
unwrapped, with its language inherited by descendants unless overridden.

Tagged reads and spatial fallback both need `doc.text.copy` and
`doc.text.select`. Without select access, the result has
`mode: 'text-only'` and a single read-order text node without spatial geometry.
Use `canRead()` and `canReadStructure()` to gate these separately. Engine errors,
missing pages, and aborts propagate instead of appearing as empty pages.
`getStructElements(pageRef)` requires both scopes and returns the original tag
ordering converted to content space; `getPageData` adds semantic HTML
decisions and fallback grouping. For a cloud engine without the optional
accessibility service, untagged fallback still works.

The plugin has no DOM dependencies. Host UI owns rendering, styles, canvas
measurement, and link navigation; pure helpers include `semanticHtmlForNode`,
`buildFontFamilyStack`, and `collectFontClasses`.
