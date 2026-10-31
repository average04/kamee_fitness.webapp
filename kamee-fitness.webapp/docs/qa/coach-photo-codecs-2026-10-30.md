# Coach photo codec acceptance — 2026-10-30

**Desktop browser result: PASS, 30/30 cases.** Independent Pillow reads also passed for all 21 successful browser outputs. No production bug or source change resulted from this acceptance run.

Run completed **2026-10-29 19:04:26 UTC / 2026-10-30 03:04:26 Asia/Manila** at source revision `6bbebbf2002bd7ba8dfe3a03e44a34168b2e7ad7`.

## Tested source and method

The local loopback harness executed source from the revision above, not a deployed Preview bundle. The actual pure modules were compiled with TypeScript 5.9.3 to browser ES modules; only relative import extensions were adjusted. Native browser decoding and canvas encoding processed seeded synthetic fixtures. Browser interaction used CUA in a dedicated local Chrome tab; no existing authenticated tab or viewport override was changed.

| Browser-executed source | SHA-256 |
| --- | --- |
| `lib/coaching/prepare-photo.ts` | `3a7a8e1fa3bf69df6c6d268896d341a708f19a39eb51cc6062ba9f39bf94595d` |
| `lib/coaching/storage.ts` | `60de91895f1e1e3e48bbcd14cc67d7a8a1f85176272ff38125bd74ec4746cad9` |
| `lib/coaching/uuid.ts` | `ee29cd5208f5e31371223bef8de0798f212124e67b94f98580ac28a94e594388` |

The six-entry run hash manifest contains these three executed modules and three source-inspected components: CoverUpload, GalleryManager and PlanEditor. All six matched final readback. Two additional files were inspected after the browser run; their hashes were recorded in `source-readback.json`, outside that six-entry manifest. Neither was browser-executed:

| Additional post-run source inspection | SHA-256 |
| --- | --- |
| `lib/coaching/gallery.ts` | `5831e42019ec3bc744e68b24fa26bf658c35116af033ffd079e44700af8b5418` |
| `app/coaching/(hub)/plans/cover/route.ts` | `cccec3e29255c5467e906a5da9fe022ba75f31b83337229b8ba021bb986b3e94` |

Reported environment: Windows desktop, Chrome `155.0.0.0` reduced user agent, native `createImageBitmap` and WebP encoder. The patch version was not independently identified. Pillow 12.2.0 generated fixtures and independently checked saved output hashes, dimensions, alpha samples, sizes and absence of source EXIF/markers. Orientation colour correctness was checked by browser pixel sampling against literal quadrant maps, not by Pillow.

## Results

| Coverage | Observed result |
| --- | --- |
| Resize and no upscaling | Avatar 512×384 or EXIF-oriented 384×512; cover/plan-cover 2048×1536; portrait gallery 1536×2048; small plan-cover retained 320×240. |
| Source and output limits | A 10,763,502-byte JPEG became a 1,427,746-byte WebP. Exactly 25 MiB was accepted; 25 MiB + 1 byte was rejected. A genuine native 7,120,814-byte WebP candidate was rejected by the 5 MiB output guard. |
| Bytes, filename and MIME | All 21 successful files had the expected filename stem, `.webp`, `image/webp`, RIFF/WEBP signature and size within 5 MiB. |
| Transparency and orientation | Alpha samples 0/128/255 were preserved, including transparent PNG bytes labelled JPEG. Browser pixel sampling confirmed all eight EXIF orientations against literal quadrant maps; orientation preceded resizing. |
| Metadata and failures | Source EXIF/GPS markers were absent from output; independent output EXIF counts were zero. ICCP colour-profile chunks were present in all 21 actual outputs. Corrupt JPEG/PNG/WebP, empty files, valid GIF and unsupported HEIC/SVG MIME admissions were rejected. |
| Compatibility probes | Two cases used real HTML image decoding with the bitmap API deliberately unavailable; EXIF orientation and alpha passed. |

CoverUpload, GalleryManager and PlanEditor prepared-file/MIME/extension handling, plus the plan-cover route and gallery admission helper, were inspected in source. They were not exercised through hosted uploads. Prior 77 passing photo/gallery/storage/plan-validation unit tests were reused; no broad suite was rerun.

## Reproducibility evidence

Local ignored artifact root: `.superpowers/qa-workspace-acceptance-20261030/`. These artifacts are intentionally not committed with this receipt:

- `codec-report.md`, `case-matrix.md`, `browser-results.json` — full matrix, measured pixels/dimensions/bytes and browser metadata.
- `source-hashes.json`, `source-readback.json`, `fixture-manifest.json` — exact source/fixture hashes; the six run-manifest sources matched final readback, with the two additional post-run inspections recorded separately.
- `independent-output-inspection.json`, `outputs/` — 21 actual browser output files and independent checks.
- `codec-summary.png`, `codec-orientation-and-limit.png` — visible browser results.
- `generate_fixtures.py`, `build-harness.cjs`, `server.py`, `index.html`, `harness.js`, `analyze_outputs.py`, `verify-sources.cjs` — replay tools. Generate fixtures, compile the real source, serve this folder on loopback, navigate its autorun page through CUA, then inspect outputs and verify source hashes. All completed command checks exited 0.

The owned loopback helper on port 18975 was verified by its process command line, stopped, and the port confirmed to have no listener. Artifact files were preserved. No browser action or test was rerun when drafting this receipt.

## Limits

This is local same-revision source evidence, not deployed-bundle or hosted-upload acceptance. It does not establish physical iOS/Android camera/library, Safari/WebKit, mobile memory or hosted-storage/profile-save behavior. Native WebP-unavailable PNG/JPEG fallback was not exercised on Safari; existing unit proof remains its evidence. Forced bitmap absence is a compatibility probe, not a claim about this browser's natural capability. HEIC/SVG checks establish MIME admission behavior, not genuine HEIC decoding or device-side transcoding. All 21 actual outputs contain ICCP colour-profile chunks; the metadata claim is source EXIF/GPS stripping.

The tested source revision remains `6bbebbf2002bd7ba8dfe3a03e44a34168b2e7ad7`. A subsequent documentation-only commit may trigger another Preview deployment; this receipt does not claim a retest of that deployed bundle.
