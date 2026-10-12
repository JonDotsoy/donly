# Security Policy

## Supported versions

`donly` is pre-1.0. Only the latest published release on npm receives security fixes.

| Version        | Supported |
| -------------- | --------- |
| latest `0.0.x` | ✅        |
| older releases | ❌        |

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report them privately through GitHub's
[private vulnerability reporting](https://github.com/JonDotsoy/donly/security/advisories/new)
or by email to [hi@jon.soy](mailto:hi@jon.soy). Include the affected version, a minimal
reproduction (ideally a `.donly` input), and the impact you observed. You can expect an
acknowledgement within a few days; fixes ship as a new patch release.

## Threat model in short

The core library is a **pure parser**: it takes a string and returns a `Directive` tree.
It never executes document contents, never evaluates code, and never follows references
on its own. Everything that touches the file system, the network, or spawns a process is
either an explicit entry point you call (`load`, the `donly` CLI), an opt-in demo, or
repository tooling that is **not shipped** in the npm package.

The sections below list every one of them.

## What the published package does

The npm package ships `src` as compiled ESM (`lib/esm`) plus the `donly` binary. Nothing
in it runs on install: there are no `preinstall` / `install` / `postinstall` scripts.
The only runtime dependency is `temporal-polyfill`.

### Core parser (`donly`, `donly/utils`, `donly/encoder`, `donly/decoder`, `donly/lint`, `donly/find`)

- Reads: nothing. Input is a string you pass in.
- Writes: nothing.
- Network / processes / environment: none.
- No `eval`, `new Function`, or dynamic `import()` on document content.

Parsing untrusted `.donly` text is therefore safe from a code-execution standpoint. As
with any parser, a very large or deeply nested input can consume CPU and memory; apply
your own size limits if you accept documents from untrusted sources.

### `donly/load`

| Access    | Detail                                                                                              |
| --------- | --------------------------------------------------------------------------------------------------- |
| File read | `readFile(filePath, "utf8")` on the single path (or `file://` URL) the caller passes to `load()`.   |
| Why       | To read a `.donly` file from disk and parse it into a plain object.                                 |
| Not done  | No directory listing, no globbing, no path rewriting, no writes. Documents cannot name other files. |

If `filePath` comes from user input, validate or constrain it in your application.
`load` opens whatever path it is given.

### `donly` CLI (`src/bin/donly.ts`)

| Command                                        | Reads                                                            | Why                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- |
| `donly lint --rules <rules> [-o json] <file>`  | The rules file (`.json` / `.donly` / `.don`) and the target file | Validate the target against the rules and print a report |
| `donly inspect [-s nested\|tuple\|raw] <file>` | The target file                                                  | Print the parsed directive tree as JSON                  |

Both commands read **only the paths given on the command line** with `readFile`, write to
stdout/stderr, and set the exit code (`1` when lint finds errors or arguments are invalid).
They never write files, never open network connections, and never spawn processes. The
only global they touch is `process.stdout.isTTY`, to decide whether to colorize output.

Lint rules in JSON form are parsed with `JSON.parse` and treated as data; rules in `.donly`
form go through the regular DON parser.

## Opt-in demo modules

These are exported for demonstration and are **not intended for production use**.

### `donly/demo/http-proxy`

A hot-reloading reverse proxy / mock server driven by a `.donly` file. This is the
module with the largest attack surface, because it opens sockets.

| Access          | Detail                                                                                                                                      | Why                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| File read       | `readFile` of the config file passed to `serve()`, re-read on every change (`fs.watch`, 50 ms debounce).                                    | Hot reload of routes and headers. |
| File read (TLS) | `ssl { cert … key … }` paths from the config, or the bundled `certs/dev-cert.pem` / `dev-key.pem` when `http2`/`http3` is on without `ssl`. | Serve HTTP/2 over TLS.            |
| Network listen  | `Bun.serve({ hostname, port })`, **default host `0.0.0.0`** (all interfaces), one listener per `server` block.                              | Be the proxy / mock server.       |
| Network client  | `fetch()` to the `proxy_pass` URL, forwarding method, headers and body.                                                                     | Reverse-proxy the request.        |

Things to know before using it:

- **It listens on every interface by default.** Set `host "127.0.0.1"` unless you mean to
  expose it.
- **The config file is trusted input.** Whoever can edit it controls which ports open, which
  upstreams are contacted (`proxy_pass`, so SSRF-style reach into your network), and which
  files are read as TLS material (`ssl`). Protect it like code.
- Request headers are forwarded as-is to the upstream; no authentication, rate limiting, or
  hop-by-hop header stripping is performed.
- **The bundled TLS key is public.** `src/demo/proxy/certs/dev-key.pem` is committed to the
  repository and shipped in the package for development only. Anyone can impersonate a server
  using it. A warning is logged whenever it is used. Never use it in production; supply your
  own `ssl` block.
- `http3 true` is not supported by Bun; the server falls back to HTTP/2 over TLS.
- Invalid edits are linted and rejected, keeping the last valid configuration running.

### `donly/demo/plugins/resources`

`createResourcesPlugin()` expands `resource sqlite file://<path>` directives. It resolves the
path against `cwd` (default `process.cwd()`) but **does not open the file**: the SQLite
inspection is simulated and always returns a fixed schema. No file contents are read today.
If you adapt it into a real plugin, note that a document-supplied `file://` path would let
the document choose what gets opened, so restrict it to an allow-listed directory.

### `donly/demo/plugins/variables`

A pure in-memory plugin (`set` / variable substitution). No file, network, or process access.

### `donly/plugins/scoped-variables`

A pure in-memory plugin with block-scoped `set`. No file, network, or process access.

## Repository tooling (not shipped to npm)

The `lib` build only includes compiled sources, so none of the following reaches consumers.
They are listed so contributors know what runs on their machine and in CI.

| Tool / script                                                                | System access                                                                                                                                                          | Why                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `npm run build` (`tsc`, `mkdir`, `cp`, `scripts/build-lib-package-json.mjs`) | Reads `package.json`, writes `lib/`; copies the dev `.pem` files.                                                                                                      | Produce the publishable package.                                |
| `npm run lint` / `fmt` (`prettier`)                                          | Reads / rewrites repository files.                                                                                                                                     | Formatting.                                                     |
| `npm run update:docs` (`tmd`)                                                | Builds, then **evaluates the `ts`/`js` code blocks** in `README.md` and `docs/**` and rewrites those files in place.                                                   | Keep documented example results in sync with real behavior.     |
| `scripts/pm.ts pack` (`bun`, `npm run build`, `npm pack`)                    | Writes a `.tgz` in the repo root.                                                                                                                                      | Produce the tarball used by smoke tests.                        |
| `scripts/smoke-test-imports/npm-pack-test.sh`                                | `mktemp -d` scratch dir, `npm init`, `npm install <tarball>`, runs `node` / `bun` / `bunx donly` / `tsc` / `bun build`, removes the dir on exit.                       | Verify the packed package installs and every entry point works. |
| `scripts/smoke-test-imports/run.mjs`                                         | Creates and deletes a temp dir via `mkdtemp` / `rm`.                                                                                                                   | Exercise `load()` against a real file.                          |
| `.kiro/skills/integration-test/scripts/*.sh`                                 | `rm -rf` / `mkdir` in `/tmp/don-integration-test`, `npm init`, `bun add <tarball>`, `cp`, `node test-runner.js`.                                                       | Local integration test of the packed package.                   |
| `.kiro/skills/bun-test/scripts/*.sh`                                         | `npm pack`, temp project in a `mktemp` directory, `npm install`, `bun test`, cleanup.                                                                                  | Local test helper.                                              |
| `.kiro/skills/integration-test/scripts/test-runner.js`                       | `readFileSync` of `cases.json` and the `.don` files it lists, in the current directory.                                                                                | Run the integration cases.                                      |
| `ide/textmate/scripts/validate-grammar.ts`                                   | Reads the grammar JSON and the files in `ide/textmate/samples`.                                                                                                        | Validate the TextMate grammar.                                  |
| `assets/brand/variant/*/generate-png.mjs`                                    | Launches Chromium via Playwright (`PLAYWRIGHT_CHROMIUM_PATH`, default `/opt/pw-browsers/chromium`), opens a local `file://` HTML, writes PNGs next to it.              | Regenerate brand cover images.                                  |
| Tests (`bun test`)                                                           | Temp directories under the OS temp dir; `http-proxy.spec.ts` binds local ports and calls `127.0.0.1`; `donly.spec.ts` and `syntax-error-recovery.spec.ts` spawn `bun`. | Exercise the CLI, the proxy and error recovery end to end.      |

Only the `NODE_ENV` and `PLAYWRIGHT_CHROMIUM_PATH` environment variables are read by this
repository's own code.

### CI and release (GitHub Actions)

- `test.yml` and `textmate.yml` run on pull requests and manual dispatch and use no secrets: `bun install`, `bun test`, the smoke tests above, and grammar validation.
- `publish.yml` publishes to npm using **OIDC trusted publishing** (`id-token: write`) with
  `--provenance`; there is no long-lived npm token. It runs `npm run lint && npm run build`
  before publishing and uses `GITHUB_TOKEN` to create the GitHub release.
- `publish-textmate.yml` publishes the VS Code extension and uses the `VSCE_PAT` secret.
- Publishing workflows trigger only on pushes to the release branch or manual dispatch,
  never on pull requests, so pull-request code never runs with publish credentials.

## Recommendations for users

1. Treat `.donly` files you did not write as untrusted data; the parser is safe for that,
   but your application's handling of the result may not be.
2. Constrain any path you pass to `load()` or the CLI.
3. Do not run `donly/demo/*` modules in production. If you run the proxy, bind to
   `127.0.0.1`, supply your own TLS certificate, and keep the config file's permissions
   tight.
4. Verify the package provenance on npm and pin the version you depend on.
