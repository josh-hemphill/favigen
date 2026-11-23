# Changelog

## 1.2.0 (2026-11-22)

First GitHub release of the Favigen library.

- Generate browser, Apple touch, and optional regular and maskable PWA icons from SVG, PNG, JPEG, or WebP artwork.
- Plan and render individual assets with configurable fit, crop, padding, and transparency. Reuse cached bytes across rebuilds and URL changes.
- Bind final build URLs and pass typed icon records to a manifest provider, or use the basic manifest helper. The draft one-shot API remains available.
- Ship ESM, CommonJS, and TypeScript declarations for Node 22.12 or newer. Sharp's WebAssembly runtime is available for standalone builds without platform-specific addons.
