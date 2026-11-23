# Favigen design Council record

The Council evaluated the design proposal for Favigen from [draft PR #16](https://github.com/josh-hemphill/favigen/pull/16), pinned at `b333605fdbbfe8213ee00e931ab5d9ec92da210e`. The three independent reviewers were A, B, and C. Each used `gpt-6.2-sol` at high reasoning effort. The facilitator prepared and revised the proposal and had no vote.

## Rubric approval

All three reviewers requested amendments to v1. The changes require an exact and sourced output inventory, explicit outcomes for rebuild and recovery scenarios, a standalone API trace, and a nested external-manifest trace under a non-root base. Reviewers also required frozen artifact IDs and separate treatment of verified experiments and planned acceptance gates. All three approved v2 without reservations.

| ID | Category | Required at the passing anchor |
| --- | --- | --- |
| D | Defaults and coverage | Clear one-source path, practical icon inventory, supported platform claims and a simple way to repair imperfect art. |
| R | Rendering | Deterministic sizing, crop and transparency, safe maskable composition, useful upstream option mapping and meaningful fixtures. |
| C | Incremental builds | Cache keys and invalidation, restart and recovery rules, output ownership and verifiable build outcomes. |
| I | Integration | A typed core and Vite handoff, final URLs and an observable manifest ownership and conflict contract. |
| E | Delivery and validation | A credible baseline, prioritized implementation, correct package and migration gates, and empirical release checks. |

Every category requires a median of at least 9.2 and at least two of three individual scores at or above 9.2 in the same round. All mandatory conditions must hold. A missing or unverifiable required assessment leaves the round incomplete. A focused on evidence, B on application across the specified contexts, and C on the fit between observations and rubric definitions. All reviewers evaluated every category.

## Round 1

Reviewed revision 1 with SHA-256 `8245e4552475def0369acee71de76a79401fbb655243372d007fed2c7bfa61b3`.

| ID | A | B | C | Median | Pass votes | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| D | 9.2 | 9.1 | 9.3 | 9.2 | 2/3 | Pass |
| R | 9.0 | 9.4 | 9.1 | 9.1 | 1/3 | Fail |
| C | 9.4 | 9.4 | 9.4 | 9.4 | 3/3 | Pass |
| I | 8.9 | 8.8 | 9.0 | 8.9 | 0/3 | Fail |
| E | 9.2 | 9.1 | 9.2 | 9.2 | 2/3 | Pass |

- A traced the profile and cache flows, requested inner-box clipping and precise matte and SVG semantics, and flagged missing manifest registration, dev readiness and CDN launch URL rules. A also requested corrected install-size and search citations.
- B found definitive rendering and cache rules but asked whether a warm cache can avoid pixel probing, which code handles dev readiness, and which compatibility contracts and entry points the next Vite major will support. B marked the fallback's missing display default and search guidance.
- C found the artifact lifecycle and incremental behavior credible. C flagged the CDN asset base versus app launch URL ambiguity, external manifest claim timing, SVG sampling and override order. All three found the manifest conflict guarantee incomplete.

Revision 2 added target-resolution SVG sampling, clipping, solid-matte semantics and override precedence. It separated CDN assets from app-origin manifests, specified a claim and hook contract, and defined readiness and collisions in both dev and build. It also corrected platform claims, made disk probe behavior explicit, and identified the Rollup and Rolldown release targets and migration paths.

## Round 2

Reviewed revision 2 with SHA-256 `81ef737f7eb8b9a00c40e2914c496a003c21b7a26d7be2959e6eabc1e089556f`. This is the accepted [workspace proposal](favigen-design.md).

| ID | A | B | C | Range | Median | Pass votes | Result |
| --- | ---: | ---: | ---: | --- | ---: | ---: | --- |
| D | 9.4 | 9.5 | 9.5 | 9.4–9.5 | 9.5 | 3/3 | Pass |
| R | 9.3 | 9.6 | 9.4 | 9.3–9.6 | 9.4 | 3/3 | Pass |
| C | 9.5 | 9.6 | 9.4 | 9.4–9.6 | 9.5 | 3/3 | Pass |
| I | 9.3 | 9.4 | 9.4 | 9.3–9.4 | 9.4 | 3/3 | Pass |
| E | 9.4 | 9.5 | 9.4 | 9.4–9.5 | 9.4 | 3/3 | Pass |

All three confirmed the required draft baseline, default SVG and PNG flows, fit/crop/alpha and safe-area policy, incremental invalidation, external manifest ownership and opt-in fallback, and prioritized acceptance plan. Each reviewer reran the synthetic build fixture independently. There were no failed criteria, unverified criteria or outstanding rubric amendments.

- A found that explicit role overrides and target-resolution SVG geometry closed the rendering gap. A asked for exact padded-cover and maskable boundary assertions and a concrete watch case that fetches the manifest and its icon URLs after changes.
- B found the source discovery, migration and split-origin URL rules traceable. B asked for coverage of authored HTML `<base href>` when base is relative, exact geometry rounding for odd dimensions, and minimum tested peer patch versions.
- C found the output, cache, and ownership contracts complete at proposal level. C asked that cached inspection facts be revalidated with current limits or keyed by validation policy, and that packaged fixtures exercise basic manifests with CDN icons, `inject: false`, ownership conflicts and watch failures.

These remain implementation checks. In particular, the synthetic CDN build case places the external fixture manifest on the CDN. The packaged basic fallback needs its own test with the manifest on the app origin and only icons on the CDN.

## Independent verification

- The draft's 33 unit tests and TypeScript check passed in an isolated copy. The package build failed while Rollup parsed its TypeScript config. A separate smoke test reproduced the disabled-manifest-file link leak and showed that metadata rebinding reused the caller's existing render while a new render call did work again.
- An isolated Vite build probe exercised Vite 6.4.6, 7.3.8 and 8.3.8 on Node 26.7.0. Each of nine combinations tested two HTML page depths, a hashed asset, a separate earlier companion emitting a nested manifest, and subpath, relative or absolute CDN asset bases. Both the native HTML asset token and the late output hook resolved the fixture asset.
- A synthetic Vite dev probe on 7.3.8 and 8.3.8 made the manifest its first request, loaded nested-page HTML, and fetched the icon at the configured subpath. Each run used one shared snapshot. Both probes exercise integration mechanics with synthetic bytes. They do not establish feature readiness, watch recovery, physical-device appearance, or production adapter performance.
