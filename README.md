# Favigen

Favigen turns one SVG or raster logo into favicon and app icon assets. Build tools can inspect the plan, render selected assets, and bind the emitted filenames and URLs before generating HTML tags or handing icon entries to a manifest provider.

Install from the GitHub release or build a tarball from this repository.

```sh
npm install https://github.com/josh-hemphill/favigen/releases/download/v1.2.0/favigen-1.2.0.tgz
```

To build from source, run `npm ci` and `npm pack`.

## Native and WebAssembly installs

The default install uses Sharp's prebuilt native runtime when it is available. If your build environment cannot load platform-specific addons, a standalone npm consumer can install the same library with Sharp's WebAssembly runtime.

```sh
npm install --omit=optional --ignore-scripts ./favigen-1.2.0.tgz @img/sharp-wasm32@0.35.5
```

Run this in a clean, dedicated build-tools install and match the WebAssembly package version to the installed Sharp version. The npm flags affect the whole install, including optional addons and lifecycle scripts required by unrelated packages. The WebAssembly runtime requires Node worker threads. It supports Favigen's outlined-text SVG subset as well as static PNG, JPEG and WebP input. Native and WebAssembly installs can produce different PNG bytes, and Favigen keys their render caches separately. [Sharp WebAssembly installation](https://sharp.pixelplumbing.com/install/#webassembly)

## Generate icons from one source

```ts
import { bindIcons, iconTags, planIcons, prepareSource, renderIcons } from 'favigen';

const source = await prepareSource('./assets/logo.svg');
const plan = planIcons(source);
const icons = await renderIcons(plan);

const bindings = new Map(icons.map((icon) => [icon.id, {
  outputFileName: `assets/${icon.name}`,
  url: `/assets/${icon.name}`,
}]));

const tags = iconTags(bindIcons(icons, bindings));
```

Write or emit each icon's `bytes` through your build tool. In the example, replace the illustrative bindings with its actual filenames and URLs. The default plan contains a multi-size ICO, 32 and 48 px PNGs, and a 180 px Apple touch icon. Use `profile: 'pwa'` to add 192 and 512 px app icons with both ordinary and maskable variants.

Paths, byte arrays and array buffers are accepted. Raster sources can be static PNG, JPEG or WebP. SVG input supports self-contained vector artwork with outlined text and local references. Favigen checks vector visibility at the selected crop and target size, so a tiny mark in a large canvas can still render when you choose a tight crop. A target that would be blank raises an error. Export complex SVG artwork with filters, stylesheet blocks or embedded images to PNG if it is outside the supported subset.

## Customize a specific role

```ts
const plan = planIcons(source, {
  profile: 'pwa',
  variants: {
    favicon: { source: await prepareSource('./assets/small-mark.png'), trim: true },
    touch: { background: '#182230' },
  },
  targets: {
    'app.any.192': { crop: [0.125, 0, 0.75, 1] },
  },
});
```

`contain` fits the whole crop. `cover` fills the padded area and clips overflow at that boundary. Crop coordinates are normalized fractions of the oriented source rectangle, after optional transparent-margin trimming. `position` anchors the artwork along two axes and `padding` reserves a fraction of the output size on each edge. Use a solid hex `background` or choose `transparent` on roles that support it. Use `resample: 'nearest'` for pixel art. Inspect `plan.diagnostics` for small-icon aspect ratio and raster upscaling feedback.

## Render and publish independently

- `renderIcon(plan, id)` renders one icon. `renderIcons(plan, { ids })` renders a subset or the entire plan.
- The default bounded memory cache reuses matching render recipes. Pass `createDiskCache(directory)` to reuse matching bytes across processes, or pass `cache: false` to bypass caching. ICO and PNG assets can share cached planes.
- `bindIcons` strips the binary payload from the published records and attaches actual bundle names and URLs. Rebind the same rendered icons for each deployment or manifest location.
- `manifestIcons(publication)` builds app icon entries for your manifest provider. `buildBasicManifest(publication, options)` returns an optional basic manifest payload. The caller owns file emission and the manifest link. Use `manifestUrl` and `urlStyle: 'relative'` for links relative to a nested manifest, and set `appUrl` when the app and asset deployment bases differ.

The draft `Favigen` class and one-shot `favigen(source, options)` entry point remain available for existing callers. The staged API above is the SVG and incremental rendering entry point. See the [design proposal](docs/favigen-design.md) for the Vite adapter, release sequence, and validation plan.
