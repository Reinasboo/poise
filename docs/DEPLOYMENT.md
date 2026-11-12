# Website and Windows installer

The public download page is a static Cloudflare Pages site at
<https://poise-3er.pages.dev/>. The project is deployed directly with Wrangler;
it is not connected to GitHub for automatic deployments. The desktop
application remains an Electron app; Cloudflare serves the page but does not
run the Windows application or its native SmartSpectra SDK.

The page and assets are plain static files. Preview locally with
`npx wrangler pages dev website`. To publish an update, authenticate Wrangler
with Cloudflare and run:

```powershell
npx wrangler pages deploy website --project-name poise --branch main
```

The `poise` Pages project must already exist. Wrangler stores its OAuth
credentials encrypted using the Windows Credential Manager.

## Installer releases

The Windows installer is distributed as a GitHub Release asset rather than
being checked into the repository or served as a Cloudflare Pages asset. This
keeps the large binary out of the source tree and avoids Pages' per-file size
limit. The website expects the stable asset name
`Poise-Setup-win-x64.exe`.

Push a version tag such as `v0.1.0` to trigger
[the Windows release workflow](../.github/workflows/release-windows.yml). It
builds the x64 NSIS installer and attaches it to the matching GitHub Release
when GitHub Actions runners are available. The website's download button points
to the latest release asset.

GitHub Actions could not start the first release build because the repository
owner's GitHub account was locked due to a billing issue. The `v0.1.0`
installer was therefore built on Windows and uploaded directly. If Actions
runners remain unavailable, build locally with `npm run dist:win`, then create
a release and attach `dist/Poise-Setup-win-x64.exe` with `gh release create`.
Resolve the GitHub billing lock before relying on tag-triggered builds.

The current installer is unsigned. Windows may show a publisher warning; do
not describe the installer as signed or verified.

## Local build

On Windows, install dependencies and build the installer with:

```powershell
npm ci
npm run dist:win
```

The output is `dist/Poise-Setup-win-x64.exe`.
