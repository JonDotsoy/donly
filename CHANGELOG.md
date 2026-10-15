# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog tracks changes to the `donly` library's public API (parsing,
stringifying, and the `DON`/`Directive` types) — not to CI, tooling, or
documentation.

## [Unreleased]

### Added

- Lint rule bodies accept `or` (alternative shapes decided per matched
  directive, so a directive such as `listen` can be valid in several formats)
  and `minArgs` / `maxArgs` (argument-count limits). Also available in the
  `.donly` rules DSL.
- `LintRuleDocument` `format` attribute (also accepted by the lint rules DSL),
  validated with `temporal-polyfill`. With `type: "string"`: `"duration"`,
  `"plain-date"`, `"plain-time"`, `"plain-date-time"`, `"instant"`,
  `"plain-year-month"`, `"plain-month-day"` and `"zoned-date-time"` (PascalCase
  aliases such as `"PlainDate"`). With `type: "number"`: `"epoch-seconds"`
  (alias `"unix"`) and `"epoch-milliseconds"`. With `type: "bigint"`:
  `"epoch-nanoseconds"`. With `type: "string"` or `type: "heredoc"` (checked
  against its content): `"json"`. With `type: "string"`: `"url"`, `"ipv4"` (optional `/0`-`/32` range),
  `"ipv6"` (optional `/0`-`/128` range), `"CIDR"` (either, optional range), `"hostname"` (RFC 1123), `"uuid"`, `"email"` (RFC 5322),
  `"regexp"` and `"semver"`. With `type: "number"`: `"port"` and its IANA ranges
  `"port-well-known"` (0-1023), `"port-registered"` (1024-49151) and
  `"port-ephemeral"` (49152-65535). When a `format`
  fails, the default issue message names the format and describes it with an
  example.
- `DON.parse(text)` — parses a DON document into an array of `Directive` nodes.
- `Directive` — represents a parsed directive with `name`, `args`
  (`number | string | boolean`), and nested `children: Directive[]`.
- Directives with zero or more positional arguments (`name "my-app"`, `port 8080`).
- Blocks (`{ ... }`) for arbitrarily nested subdirectives.
- Repeated directive names at the same level (e.g. multiple `route` directives).
- Identifiers with special characters (`$`, `-`, `/`, `:`, `[`, `]`), including
  interpolation-like tokens (`${name}`) and path-like tokens (`/api/:name`).
- Numeric literals: integers, decimals, hexadecimal (`0x`), octal (`0o`), binary
  (`0b`), and BigInt (`n` suffix, including hex/octal/binary BigInt).
- String literals with single or double quotes and escaped delimiters (`\"`, `\'`).
- Boolean (`true`/`false`) and `null` literals.
- Heredoc syntax (`<<<DESCRIPTOR`) for multi-line content blocks with
  indentation-based payload extraction.
- Single-line (`#`) and multi-line (`/* ... */`, non-nesting) comments.
- `LexerParser` and `SyntaxEncode` — lower-level tokenizer and syntax parser
  exports for building custom tooling on top of DON.
- `donToParts(text)` — utility to break a DON document into typed lexical parts.
- `Directive#find(path)` / `Directive#findAll(path)` / `Directive#at(path)` —
  query a `Directive` (treated as the document root) using an absolute path
  expression (e.g. `/server/route`, with `|` alternatives). `find`/`findAll`
  return the first/all matching directives; `at` resolves the path, and a
  path ending in `[N]` (1-based) returns that directive's argument at
  position `N` instead of the directive itself. Backed by `findDirective`,
  `findAllDirectives`, and `atDirective` (`donly/find`), along with
  `PathExpression`, which parses and matches the path syntax also used by
  lint rule keys.
- `lintSchema(don, rules)` (also exported as `lint`, from `donly/lint`) — runs
  a declarative `LintRuleDocument` against a DON source string and returns
  the `LintIssue`s it reports. A rule document is keyed by directive path
  (e.g. `"/server/port"`), optionally fused with a 1-based argument selector
  (`"/server/port[1]"`); each body may combine `required`/`min`/`max`
  occurrence checks, nested sub-paths, `"[N]"` argument constraints
  (`type`, `enum`, `gt`/`gte`/`lt`/`lte`, `pattern`/`flags`, `or`/`and`/
  `not`), and an `evaluation` escape hatch. See `docs/lint/rules.md` for the
  full format. `renderReport`/`renderJSONReport` turn a `LintIssue[]` into an
  ESLint-style text report or a `JSONReport`. The previous function-based
  `LintRule`/`evaluation` engine moved internal (`src/lint.ts`, deprecated,
  no longer published as `donly/lint`).
- `donly` CLI (`bin/donly.js`, invoke with `npx donly`/`bunx donly`) with a
  `donly lint --rules <rules.json> <file>` command: runs `lintSchema` against
  a `.donly` file using a `LintRuleDocument` JSON file, prints an ESLint-style
  report via `renderReport`, and exits non-zero when any issue is an error.
  Accepts `--output`/`-o` `default | json` to switch between `renderReport`'s
  text report (default) and `renderJSONReport`'s `JSONReport`. Also adds a
  `donly inspect [--strategy|-s nested|tuple|raw] <file>` command: parses a
  `.donly` file and prints it as JSON via `DirectiveJSONEncoder`, defaulting
  to the `nested` reducer (`tuple` and `raw`, the lossless
  `{ name, args, children }` shape, are also available).
- `DON.parse(text, { plugins })` — an optional second argument accepting a
  `DonPlugin[]`. `DonPlugin<TContext>` is generic over its own `ctx`
  state — there's no fixed `DonPluginContext` shape, `ctx` is whatever a
  plugin needs (a plain object, an array, a class instance, anything).
  Each plugin's `onDirective(node, ctx)` runs once per directive,
  depth-first pre-order (matching the document's own reading order, and
  the "Sequential Processing" pipeline model), before that directive is
  built into a `Directive`. `node` is readonly and never mutated in
  place: `onDirective` returns a new `PluginDirectiveNode` to change what
  gets built (e.g. resolve a `$foo` reference), `null` to drop the
  directive — and its children — from the resulting tree entirely (e.g. a
  `set` pragma with only a side effect), or nothing (`void`) to leave
  `node` as-is. `ctx` is this plugin's own —
  built once per `DON.parse()` call from `initContext()` when the plugin
  defines it, otherwise `undefined` (`DON.parse()` never builds one on a
  plugin's behalf) — and is **never shared with another plugin's `ctx`**,
  so two plugins can't collide on the same state. Define `initContext()`
  to give a plugin state at all, to seed it with initial values, or to
  return a `ctx` you keep a reference to yourself, to read it back after
  parsing.
- `variablesPlugin` (`donly/demo/plugins/variables`) — a first demo
  `DonPlugin`, built on a `Map<string, string>` `ctx`: a `set` directive
  (`set <name> <value>`) stores `<value>` (stringified) under `<name>` and
  is dropped from the tree; any later `$<name>` argument resolves to that
  string.
- `PluginDirectiveNode#children` — an optional field a plugin's
  `onDirective` can set on the node it returns, replacing that
  directive's children in the resulting tree with a synthetic subtree
  (built directly into `Directive`s, bypassing the lexer/syntax parser
  and any further plugin) instead of whatever children the source had.
- `createResourcesPlugin(options?)` (`donly/demo/plugins/resources`) — a
  second demo `DonPlugin` factory: expands a `resource sqlite <file-url>`
  directive into the (simulated) data it points at — the `file://` URL's
  path resolved to an absolute one (against `options.cwd`, default
  `process.cwd()`) and `size`/`table`/`columns` children describing a
  fake schema, via `PluginDirectiveNode#children`. Any other `resource`
  type, or a directive that isn't `resource`, passes through untouched.
- `DonSyntaxError` (`donly/common/errors`, also at `src/common/syntax-error.ts`)
  — a dedicated `SyntaxError` subclass for malformed DON source text, so
  callers can check `error instanceof DonSyntaxError` to distinguish a
  DON parsing failure from any other error a call into this library
  might throw.
- `inspect(directive, strategy?)` (`donly/utils`) — encodes a `Directive`
  (or `Directive[]`) to a plain JSON value using one of `InspectStrategy`'s
  shapes: `"nested"` (default, `DirectiveJSONEncoder.nestedReducer`),
  `"tuple"` (`DirectiveJSONEncoder.tupleReducer`), or `"raw"` (the lossless
  `{name, args, children}` array shape, no reducer). Backs the CLI's
  `donly inspect` command.

### Changed

- `HeredocValue.delimiter` is now `HeredocValue.descriptor`: the identifier after
  `<<<` is a free-form label describing the content (`HTML`, `BASH`), not a
  delimiter. The JSON shape produced by `DirectiveJSONEncoder` uses
  `descriptor` (the legacy `delimiter` key is still accepted when decoding), and
  the TextMate scope is now `entity.name.tag.heredoc-descriptor.don`.

### Deprecated

- `HeredocValue.delimiter` (alias of `descriptor`). It is renamed to
  `deprecated_delimiter` on 2027-01-04 and removed entirely on 2027-04-04.

### Fixed

- Heredoc parsing (`<<<DESCRIPTOR`) no longer unconditionally swallows the
  first line after the declaration into the payload. Per spec (§ 2.8
  Heredocs), content must have _greater_ indentation than the heredoc
  declaration line, and this rule now applies starting from the very
  first content line, not just subsequent ones — so `foo <<<EOF` followed
  by a line at the same (or lesser) indentation now yields an empty
  heredoc payload and that line becomes a sibling directive, instead of
  being swallowed as content.
- `DON.parse` now enforces the spec §2.2 block-close constraint: a
  directive's `{ ... }` block may only be followed on the same line by a
  newline, a comment, another block's closing `}`, or end of input.
  Previously `container { image "nginx" } extra` silently parsed `extra`
  as a positional argument of `container` instead of raising a syntax
  error.
- `DON.parse` now throws a `SyntaxError` for an unterminated single- or
  double-quoted string (a quote with no matching closing quote before the
  string's line ends or before end of input), instead of silently leaking
  the opening quote as a literal character into the arg value and
  producing a corrupted `Directive` tree. The lexer (`Token`) already
  detected this case and recorded it via `Token#getErrors()`, but nothing
  in the parsing pipeline consulted it; the syntax parser now checks every
  token's `getErrors()` as it consumes it and fails fast on the first
  error found. The lexer's own unclosed-string detection was also
  extended to cover a string that runs off the end of the document (not
  just one broken by a raw newline), which previously matched no token at
  all instead of being flagged.
- `DON.parse(text)` now raises a synchronous `SyntaxError` for an
  unterminated block (a `{` with no matching `}` before the input ends),
  e.g. `DON.parse("foo {")`. Previously the syntax parser spun forever
  waiting for a closing `}` token that would never arrive — an infinite
  loop that hung the process and grew memory unbounded — instead of
  reporting the malformed input.
- All syntax-error throw sites in the parser (`src/v1/compiler/syntax-encode.ts`)
  — an unclosed string/heredoc reported by the lexer, tokens found after a
  block's closing `}` on the same line, an unterminated block missing its
  closing `}`, and a block with no directive name on its line (see below)
  — now throw `DonSyntaxError` instead of a plain `Error`/`SyntaxError`, so
  `error instanceof DonSyntaxError` reliably identifies a
  malformed-DON-source failure from `DON.parse`.
- `DON.parse` now raises a syntax error for a `{` block on its own line
  with no preceding directive name (e.g. a stray block at the document
  root). Per spec §2.2, a block is always the tail of a directive's own
  line, never a standalone construct. Previously such an orphan block was
  silently dropped — or, if another directive followed later in the
  document, its content was silently reattached as children of that
  unrelated directive instead.
