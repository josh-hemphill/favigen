# Favigen

Library-first favicon / web app icon generation for bundlers and other integrating applications.

The usual Node ecosystem default is [`favicons`](https://github.com/itgalaxy/favicons): a one-shot `favicons(source, options) → { images, files, html }` call. That shape is fine for a CLI, and painful for Vite/webpack/Rollup plugins that need to **inspect the plan, emit assets through the bundler, then rewrite public URLs** without running the image pipeline again.

Favigen keeps a mutable icon map, renders pixels independently of HTML/manifests, and re-emits metadata from the current path bindings.

## Status

This started in June 2021 as a scaffold copied from another package (CSP header helpers). The README was later reduced to a WIP note. What was on `latest`:

| Area | Where it left off |
| --- | --- |
| Package metadata / tests | Still the CSP template (`CspDirectives`, changelog, keywords, leftover unit tests) |
| `Favigen` class | Constructor built an `iconsMap`; `transformIcons` / `afterCreate` / `alterImg` were sketched |
| Image pipeline | `generateIcon()` applied a drop shadow and returned PNG — **no resize, contain, background, or offset** |
| HTML / manifests | Helpers existed but `getHtml()` / `getManifests()` returned placeholder `'hi'` |
| Paths | Bound at construct time; no rebind-after-emit API (the reason this package exists) |
| Rollup | Still pointed at `src/lib/index.ts` from the template |

This revision turns that sketch into a usable integration surface: plan → optional transform → render images → rebind public URLs → emit HTML/manifests.

## Why not just use `favicons`?

Itgalaxy `favicons` **is** a Node module, but the API is CLI-shaped:

1. Paths are baked in during `create()`. HTML, `manifest.webmanifest`, and `browserconfig.xml` all close over `options.path`.
2. There is no inspectable plan. You cannot list filenames, rename them, or disable one size without either knowing the hardcoded names or generating everything.
3. `output.images/files/html` can skip channels, but skipped HTML still cannot be produced later from already-rendered images with new URLs.
4. The stream helper still runs a full `favicons()` per vinyl/file object.

That is exactly what blocked [vite-plugin-favicon](https://github.com/josh-hemphill/vite-plugin-favicon): hashed asset URLs from Vite required regenerating every icon.

The contract for a bundler:

```ts
import { Favigen } from 'favigen';

const pipeline = new Favigen('./logo.png', {
  appName: 'My App',
  icons: { appleStartup: false, yandex: false, windows: false },
});

// 1. Inspect / reshape the plan without rendering
pipeline.transformIcons((id, icon) => {
  if (icon.width < 48) icon.disable = true;
  icon.name = `icon-${icon.width}.png`;
});

// 2. Stream binaries into the bundler as they are created
await pipeline.getIcons((icon) => {
  this.emitFile({ type: 'asset', fileName: icon.name, source: icon.contents });
});

// 3. After the bundler returns hashed URLs, rewrite metadata only
pipeline.setIconHref('icon-192.png', '/assets/icon-192.abc123.png');
const html = pipeline.getHtml();
const files = pipeline.getManifests();
```

`favigen(source, options)` remains available for one-shot CLI-style use and matches the `{ images, files, html }` shape plugins already expect.

## Comparison with `favicons` 7.3

Capabilities aimed at covering the bulk of integrating-app usage:

| Capability | favicons 7.3 | Favigen now |
| --- | --- | --- |
| PNG resize (contain + optional offset/background) | sharp | Jimp |
| Multi-size `favicon.ico` | yes | yes |
| Platform toggles + pick-by-filename | yes | yes |
| Android / Apple / Windows / Yandex + web manifest | yes | yes |
| Independent `images` / `files` / `html` output | yes | yes |
| Public path prefix | construct-time only | construct-time, `setPublicPath`, or per-icon `setIconHref` |
| Inspect plan before render | no | `iconsMap` / `enabledPlatforms` |
| Rename/disable icons in the plan | filename allowlist only | `transformIcons` |
| Re-emit HTML/manifests after path rewrite | regenerate everything | metadata only |
| Streaming per asset | vinyl Transform of whole jobs | `getIcons(afterCreate)` |
| Structured HTML (`htmlTags`) | yes | yes |
| Cache-bust query, credentials on manifest | yes | yes |
| `manifestRelativePaths`, rename manifest files | yes | yes |
| Related applications on the web manifest | yes | yes |
| SVG source / SVG favicon | sharp + svgtool | **not yet** (Jimp) |
| Maskable extra source set | yes | **not yet** |
| Manifest shortcuts | yes | **not yet** |
| Best-of sourceset (array of images) | yes | **not yet** |
| Pixel-art nearest-neighbor upscale | yes | yes |
| Opera Coast / Firefox OS | dropped | available, **off by default** |

Image **pixels** will not match favicons snapshots: they use sharp/lanczos, this package uses Jimp. Filename sets, HTML, and manifest structure are the compatibility target.

## Tests reused from `favicons`

Source: <https://github.com/itgalaxy/favicons/tree/master/test>

We reused the **behaviors**, not the sharp image snapshots:

| favicons test | What we kept |
| --- | --- |
| `failure.test.mjs` | no source, wrong type, empty buffer, missing path |
| `restrict.test.mjs` | filename allowlists per platform; configure+restrict |
| `output.test.mjs` / `noassets.test.mjs` | `output.images/files/html` and all-platforms-off |
| `pickedSizes.test.mjs` | ico-only vs png-only selection |
| `prefixed.test.mjs` | `path` prefix on HTML |
| `manifest.test.mjs` | related apps, rename manifests |
| `manifestRelativePaths.test.mjs` | basename-only `src` in manifests |
| `loadManifestWithCredentials.test.mjs` | `crossorigin="use-credentials"` |
| `cacheBusting.test.mjs` | `cacheBustingQueryParam` |
| `meta.test.mjs` | app metadata in HTML + manifest |
| `background.test.mjs` / `offset.test.mjs` | canvas stays the requested size |
| `pixelart.test.mjs` | `pixel_art` still emits the target size |

Not ported yet (need SVG/multi-source/maskable/shortcuts): `svg*.test.mjs`, `array.test.mjs`, `manifestMaskable.test.mjs`, `manifestShortcuts.test.mjs`, `stream.test.mjs`.

Library-first tests that favicons cannot express: inspect `iconsMap` before render, `setIconHref` without changing PNG bytes, `transformIcons` rename/disable, `afterCreate` emit hook.

## Remaining gaps for a large slice of production use

Highest value next:

1. **SVG sources** — every modern Vite plugin advertises "svg works too"; requires sharp (or resvg) instead of/in addition to Jimp.
2. **Maskable Android icons** and **manifest shortcuts**.
3. **Multi-source selection** (prefer SVG, then closest larger raster).
4. Drop or implement Firefox glow/circle-mask (legacy; off by default).

## Installation

```shell
npm i -D favigen
```

## API

```ts
import { Favigen, favigen, config } from 'favigen';

const pipeline = new Favigen(source, {
  path: '/',
  appName: 'My App',
  icons: {
    android: true,
    appleIcon: true,
    appleStartup: false,
    favicons: ['favicon.ico', 'favicon-32x32.png'],
    windows: false,
    yandex: false,
  },
});

await pipeline.generate(); // { images, files, html, htmlTags }
```

`config.defaults` and `config.platforms` are the inspectable default option/size tables.
