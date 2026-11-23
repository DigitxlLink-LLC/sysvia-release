# Homepage showcase

This directory contains captures of the animations on [getsysvia.com](https://getsysvia.com/), plus the existing 60.7-second homepage walkthrough. GIF previews play in the repository README; each preview links to its H.264 MP4 version. The website links provide the interactive originals.

## Sources

- `keyboard-mouse`: the homepage Software KVM card, rendered by `sitev2/assets/sysvia-feature-art.js` and its stylesheet. The native screen captures, photographed workspace artwork, pointer movement, magnifier and typing are the site's existing assets and animation.
- `remote-screen`: the homepage remote-screen card from the same controller. It uses the site's café artwork and native macOS/Windows interface captures, with scripted transitions.
- `extended-monitors`: the homepage extended-monitor card, rendered by `assets/extended-monitors-card.js` and its stylesheet. A selected Mac-host setup keeps the capture focused on one desktop spanning the MacBook, a borrowed PC monitor and a work laptop.
- `walkthrough.mp4`: an unchanged copy of `sitev2/assets/hero-walkthrough/walkthrough-mobile.mp4` (960 × 540, H.264, 60.7 seconds).
- `walkthrough-poster.webp`: the existing homepage walkthrough poster.

All animation captures are illustrative, scripted website content with example data. They do not establish live device connectivity, transfer speed, or platform certification. The scenes use Windows and macOS example screens. The walkthrough's renderer is real Sysvia UI with scripted connections and transfers; some operating-system overlays are recreated. Remote and extended sessions are demonstrations, not recordings of a live session. Hardware and setting artwork includes generated imagery. Apple and Microsoft retain rights to their interface imagery.

The website source has detailed provenance in `deliverables/walkthrough-assembly/PROVENANCE.md`, `sitev2/assets/kvm-scene/README.md`, `sitev2/assets/remote-scene/README.md` and `sitev2/assets/monitor-scene/README.md`. This export reuses those existing visuals and does not introduce new artwork.

`manifest.json` records the website commit, capture dimensions, durations, frame counts, sizes and SHA-256 hashes.

## Reproduce

Use a checkout of the Sysvia website, an installed Playwright with Chromium, and `ffmpeg` on your path. Start the website's static preview:

```sh
python3 sitev2/tools/preview.py
```

From this repository, run:

```sh
SYSVIA_PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
node tools/capture-website-showcase.cjs /absolute/path/to/SysviaWebNew
```

`SYSVIA_PREVIEW_URL` defaults to `http://127.0.0.1:8767`. The capture script extracts the original card markup from the homepage and uses the original stylesheets and controllers. It records those animations in Chromium, crops each recording to the card, and creates 30 fps H.264 MP4s plus 640-pixel-wide, 8 fps GIF previews. Temporary recordings are removed when it finishes.

The script writes only showcase media and metadata. Published installers, checksums, release tags and update manifests are unrelated to this export.

For an interrupted export from the same website checkout, add `--reuse` to keep already completed GIF/MP4 pairs. Omit it to record every card again.
