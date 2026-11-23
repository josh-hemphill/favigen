# Favigen implementation and SVG dependency review

The Council reviewed the staged Favigen library and the compatibility entry points on `codex/favigen-implementation`. The production Vite adapter remains the next implementation slice. Reviewers A, B, and C used `gpt-6.2-sol` at high reasoning effort. The facilitator verified the experiments and revised the code without voting.

## Review contract

All three reviewers requested a reproducible native-free SVG rasterization check in rubric v1. All three approved v2. The approved rubric requires each category to meet a median of at least 9.2, at least two votes at or above that threshold, and all mandatory conditions on the same revision. An unverifiable required assessment makes a category incomplete.

## Round 1

Frozen artifact SHA-256 `787b47fdc13931d2c447d80a3b14ffc6343a0bc9ccb9c84c42a2c162b119c620`. All three confirmed the mandatory checks within the tested scope.

| Category | Target | A | B | C | Range | Median | Pass votes | Result |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| Rendering and input | ≥9.2 | 8.8 | 8.7 | 8.6 | 8.6–8.8 | 8.7 | 0/3 | Fail |
| Packaging and dependency | ≥9.2 | 9.4 | 9.4 | 9.3 | 9.3–9.4 | 9.4 | 3/3 | Pass |
| Caching and resources | ≥9.2 | 8.7 | 8.9 | 8.6 | 8.6–8.9 | 8.7 | 0/3 | Fail |
| API and validation | ≥9.2 | 9.0 | 8.8 | 9.0 | 8.8–9.0 | 9.0 | 0/3 | Fail |

- A reproduced empty pixels for a collapsed crop and a representable narrow cover crop on native Sharp. A flagged resource admission and URL directory identity.
- B independently rebuilt and packed the frozen code. B reproduced an undetected truncated JPEG, failed optional cache operations, and a launch URL outside a supplied scope.
- C independently matched compiled code to the packaged consumer and reran portable rendering. C reproduced the 1,024-byte SVG sniffing limit, failed cache error callbacks, and the loss of trailing slashes on rebased URLs.

Revision 2 validates complete bounded source data, samples SVG visibility, renders narrow vector crops with an explicit viewport transform, and rejects collapsed geometry. A shared queue limits active image work by job count and estimated working bytes. Failed cache reads and writes are recoverable, including failures in error observers. Manifest URL conversion preserves the resolved URL, and the basic helper checks launch URL containment when the paths are comparable.

## Round 2

Frozen artifact SHA-256 `b004b29596246587aaf3bd13bd2ef1aa7a74c1f0a07050fb2d0c044d732c23de`. All three again confirmed the mandatory checks.

| Category | Target | A | B | C | Range | Median | Pass votes | Result |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| Rendering and input | ≥9.2 | 9.1 | 9.1 | 9.1 | 9.1 | 9.1 | 0/3 | Fail |
| Packaging and dependency | ≥9.2 | 9.5 | 9.5 | 9.4 | 9.4–9.5 | 9.5 | 3/3 | Pass |
| Caching and resources | ≥9.2 | 9.3 | 9.1 | 9.0 | 9.0–9.3 | 9.1 | 1/3 | Fail |
| API and validation | ≥9.2 | 9.4 | 9.1 | 9.1 | 9.1–9.4 | 9.1 | 1/3 | Fail |

- A verified the native and WASM narrow-crop fix but reproduced a valid sparse SVG that the bounded source visibility sample rejected before cropping. B and C reproduced the same class of failure with different artwork.
- B and C confirmed that rejected promises from asynchronous cache error observers were still unhandled.
- B reproduced a false conflict between document-relative and root-relative asset URLs. C reproduced a conflict that the source-level check missed between absolute and root-relative URLs resolving to the same asset at the manifest location.

Revision 3 checks visibility at the actual vector crop and target size, so source preparation can accept fine artwork that needs cropping. It handles synchronous throws and promise rejections from cache error callbacks. It keeps URL references distinct while their base is unknown, then checks resolved URL and digest conflicts at the manifest boundary when a base is available.

## Round 3

Frozen artifact SHA-256 `8c9ea9785c64158d546882bb11506dc0c7dfc2ce07239eea86f87a89332ec397`. All three reviewers passed all mandatory conditions and all categories in the same round.

| Category | Target | A | B | C | Range | Median | Pass votes | Result |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- |
| Rendering and input | ≥9.2 | 9.4 | 9.4 | 9.3 | 9.3–9.4 | 9.4 | 3/3 | Pass |
| Packaging and dependency | ≥9.2 | 9.5 | 9.5 | 9.4 | 9.4–9.5 | 9.5 | 3/3 | Pass |
| Caching and resources | ≥9.2 | 9.4 | 9.4 | 9.3 | 9.3–9.4 | 9.4 | 3/3 | Pass |
| API and validation | ≥9.2 | 9.5 | 9.4 | 9.3 | 9.3–9.5 | 9.4 | 3/3 | Pass |

- A reproduced the earlier large-viewBox crop on native and WASM and verified a visible target on both. A verified the shared estimated admission budget and noted that compressed source buffers waiting for admission are outside that accounting.
- B verified strict unhandled-rejection behavior, cache retries, and that root-relative and document-relative URL references remain distinct until the manifest context resolves them.
- C verified native-free PNG and ICO output from all four input formats with the final staged package on Linux x64 under Node 22.12.0, 24.22.3 and 26.7.0. C checked alias conflicts in bound and relative manifest modes and the core and legacy package interfaces.

The final revision passed 48 tests under Node 22, 24, and 26. Installed ESM, CommonJS, NodeNext TypeScript, and Vite 7 and 8 package probes passed. This record covers Linux x64 and the library package. Other operating systems, browser PWA installation, and the production Vite adapter are outside the verification evidence.

## Renderer comparison

A clean Linux x64 consumer rendered SVG, PNG, JPEG, and WebP into eight PWA-profile PNG/ICO assets with Sharp 0.35.5. The alternate install explicitly included `@img/sharp-wasm32@0.35.5` and omitted platform-specific libraries. The tested dependency tree contained no native addons or shared libraries. SVG fixtures exercised a local fragment, a gradient, thin detail, and an explicit crop. Verification covered output dimensions, maskable opacity, ICO frame data, and visible pixels. Native and WASM outputs can differ, and the cache fingerprint keeps them separate.

| Payload on Linux x64 | Compressed package archives | Installed apparent size |
| --- | ---: | ---: |
| Native Sharp addon and libvips | 8.02 MiB | 18.25 MiB |
| Sharp generic WASM package | 3.48 MiB | 8.89 MiB |
| Standalone resvg-WASM | 0.92 MiB | 2.41 MiB |

The default clean install included both Sharp payloads and its production dependency tree was 68.4 MiB. The explicit WASM install was 50.2 MiB. These figures describe the tested npm resolution on Linux x64. The standalone resvg probe produced PNGs from the SVG fixture at widths of 32, 192 and 512 px. It does not provide the raster input pipeline or the ICO contract on its own. Keeping Sharp with a documented WASM install keeps the existing formats and staged API available. [Sharp WebAssembly](https://sharp.pixelplumbing.com/install/#webassembly) · [resvg-WASM](https://github.com/thx/resvg-js)
