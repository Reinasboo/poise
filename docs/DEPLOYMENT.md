# Website and Windows installer

The public download page is a static Cloudflare Pages site in `website/`.
The desktop application remains an Electron app; Cloudflare serves the page
but does not run the Windows application or its native SmartSpectra SDK.

## Cloudflare Pages

Create a Pages project in the Cloudflare dashboard and connect the
`Reinasboo/poise` GitHub repository. Set the production branch to `main`, leave
the build command empty, and set the build output directory to `website`.
The page and its assets are plain static files; no runtime, account, API, or
environment variable is required. Preview locally with
`npx wrangler pages dev website`, or deploy directly with
`npx wrangler pages deploy website --project-name poise` after authenticating
Wrangler and creating the Pages project.

## Installer releases

The Windows installer is distributed as a GitHub Release asset rather than
being checked into the repository or served as a Cloudflare Pages asset. This
keeps the large binary out of the source tree and avoids Pages' per-file size
limit. The website expects the stable asset name
`Poise-Setup-win-x64.exe`.

Push a version tag such as `v0.1.0` to trigger
[the Windows release workflow](../.github/workflows/release-windows.yml). It
builds the x64 NSIS installer and attaches it to the matching GitHub Release.
The website's download button points to the latest release asset. Until a
release is published, that download URL will not resolve.

The current installer is unsigned. Windows may show a publisher warning; do
not describe the installer as signed or verified.

## Local build

On Windows, install dependencies and build the installer with:

```powershell
npm ci
npm run dist:win
```

The output is `dist/Poise-Setup-win-x64.exe`.
