# Installing conductor in other projects

conductor is not published to npm yet. Every tagged version (`v*`) is attached to a
[GitHub release](https://github.com/patrickhofmann0/agent-conductor/releases) as an npm
tarball. It runs on plain Node.js ≥ 22.12, Bun is not needed.

## From a release

```bash
gh release download v0.1.0 --repo patrickhofmann0/agent-conductor --pattern '*.tgz'
npm install -g ./agent-conductor-0.1.0.tgz
conductor --version
```

`gh release download` also works for private repositories. Update by installing a newer
tarball the same way.

## From source (development)

```bash
git clone https://github.com/patrickhofmann0/agent-conductor.git
cd agent-conductor
bun install
bun run build
bun link              # makes `conductor` available globally
```

Run `bun run build` again after every change.

## No API key needed locally

A local run uses the model provider you are logged in with in OpenCode, for example
GitHub Copilot. See [Running locally](local-usage.md) for requirements and the first run.

## How releases are made

Pushing a tag such as `v0.1.0` starts `.github/workflows/release-tarball.yml`. It runs
`bun run verify`, sets the version from the tag, packs the tarball, installs it into an
empty project with npm to prove it works without Bun, and creates the release.
