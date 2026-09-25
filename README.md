# IIIF Image Gallery Builder

A browser-based tool for creating, curating, and sharing galleries of images from IIIF-compatible libraries, archives, and museums worldwide.

**→ [Open the Gallery Builder](https://davidrumseymapcenter.github.io/set-builder/index.html)**  
**→ [Help & Quick Reference](https://davidrumseymapcenter.github.io/set-builder/info.html)**  
**→ [Full Tutorial with Screenshots](https://davidrumseymapcenter.github.io/gallery-builder-tutorial/)**

---

## What it does

The Gallery Builder lets you pull images from any IIIF-compliant institution into a single curated gallery. You can zoom into high-resolution images, rearrange and annotate them, and share the result as a link, an embedded Canvas page, or a standards-compliant IIIF manifest.

Thousands of institutions support IIIF, including the Library of Congress, the British Library, Stanford, Yale, and the David Rumsey Map Collection.

---

## Three modes

| Mode | URL | Purpose |
|------|-----|---------|
| **Builder** | `index.html` | Create and edit galleries |
| **Viewer** | `viewer.html` | Read-only with curator notes visible |
| **Presentation** | `presentation.html` | Clean view, no notes, for classroom use |

You can switch between modes by changing the filename in the URL.

---

## Key features

- Add images from any IIIF 2.0 or 3.0 manifest
- Select individual pages from multi-page documents
- Drag-and-drop reordering
- Curator notes — date-stamped, saved with the gallery file, and visible in Viewer mode
- Resizable split-panel layout with OpenSeadragon zoom viewer
- Input panel accordion to show or hide sections and maximize gallery space
- Active card indicator highlighting the image currently loaded in the viewer
- Two save formats:
  - **Gallery file** (`.gallery.json`) — reloadable in this app, preserves all selections and notes
  - **IIIF manifest** (`.manifest.json`) — standards-compliant, opens in Universal Viewer, Mirador, and other IIIF viewers
- Deep-link loading via `?file=` URL parameter
- Links to the source item, IIIF manifest, and Allmaps georeferencing editor on every card

---

## Sharing galleries

Save your gallery as a JSON file and upload it to [GitHub Gist](https://gist.github.com) to get a permanent shareable link:

```
https://davidrumseymapcenter.github.io/set-builder/index.html?file=YOUR_GIST_RAW_URL
```

Replace `index.html` with `viewer.html` or `presentation.html` to share in a different mode.

---

## Embedding in Canvas LMS

```html
<iframe 
  src="YOUR_GALLERY_URL" 
  width="100%" 
  height="900"
  title="IIIF Image Gallery">
</iframe>
```

See the [help page](https://davidrumseymapcenter.github.io/set-builder/info.html) for full instructions and troubleshooting.

---

## Technical notes

The Gallery Builder runs entirely in the browser with no backend server, no accounts, and no data collection, and can be hosted on GitHub Pages or any static host.

We provide two save formats because selecting pages from multi-page documents creates modified manifests that don't exist at a permanent URL. The `.gallery.json` format embeds complete manifests to preserve those selections faithfully. The `.manifest.json` format flattens everything into a single standards-compliant IIIF 2.0 manifest for use in other viewers and applications.

The tool supports both IIIF 2.0 and 3.0 manifests and quietly sanitizes common validation issues found in source manifests — such as `otherContent` being serialized as a string rather than an array — on export.

---

## Forking and contributing

We have kept the codebase simple, with just three HTML files, one shared `script.js`, and one `styles.css`, and no dependencies beyond OpenSeadragon, loaded via CDN. There are no build tools or frameworks to configure.

The files are organized as follows:

- `index.html` — Builder
- `viewer.html` — Viewer
- `presentation.html` — Presentation
- `script.js` — All application logic
- `styles.css` — Shared styles
- `info.html` — Help page

Issues and pull requests are welcome via [GitHub](https://github.com/davidrumseymapcenter/set-builder/issues), or email us at [rumseymapcenter@stanford.edu](mailto:rumseymapcenter@stanford.edu).

---

## Credits

Built at the [David Rumsey Map Center](https://library.stanford.edu/rumsey), Stanford University Libraries, in collaboration with Claude Sonnet (Anthropic) as a coding partner.

Uses [OpenSeadragon](https://openseadragon.github.io/) for high-resolution image viewing.
```
