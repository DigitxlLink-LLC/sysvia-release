# App screenshots

These captures use the real Sysvia app renderer with the website’s sample-data fixture. They show the Sage theme with example computers, folders and engine replies. They do not show a live multi-computer session.

The source app reports version **2.3.9**. Exact source commits, capture settings, image dimensions and checksums are recorded in [manifest.json](manifest.json).

## Recreate

Check out the app and website sources listed in the manifest. Install the app’s Playwright dependency and Chromium, then run from the release repository:

```sh
node tools/capture-app-screens.mjs /absolute/path/to/SysviaWebNew /absolute/path/to/sysviaappprod
```

Set `SYSVIA_PLAYWRIGHT_MODULE` to an installed Playwright module if it is outside the app’s `node_modules` directory. The script serves the renderer on localhost, blocks external browser requests and closes its browser and server when finished. It does not sign in or start native services.

The gallery uses eight WebP images at 1920 × 1290 pixels (a 1280 × 860 viewport at 1.5× scale). Older screenshots remain in `media/` for existing references.
