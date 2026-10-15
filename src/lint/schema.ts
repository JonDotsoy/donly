/**
 * Type definitions for the object/JSON-format `LintRule` design described in
 * `docs/lint/rules.md`. This module is types only — there is no
 * runtime behavior here, only the shapes a lint rule document may take.
 */
import type { Directive } from "../don.js";
import type { LintIssue } from "./types.js";

/** Mirrors `LintIssue["severity"]` in `./lint.ts`. */
export type RuleSeverity = "error" | "warning" | "info";

/** Every argument kind DON v1 produces (see `docs/specs/v1/spec.md`). */
export type ArgumentType =
  | "string"
  | "number"
  | "bigint"
  | "boolean"
  | "null"
  | "heredoc";

/** A literal value an argument's `enum` constraint may compare against. */
export type ArgumentLiteral = string | number | boolean | null;

/** Fields every constraint shares, regardless of `type`. */
export interface BaseArgumentConstraint {
  enum?: readonly ArgumentLiteral[];
  or?: readonly ArgumentConstraint[];
  and?: readonly ArgumentConstraint[];
  not?: ArgumentConstraint;
  message?: string;
  severity?: RuleSeverity;
  /**
   * Escape hatch: arbitrary custom logic for this argument, e.g.
   * `{ "/path[1]": { evaluation: (argument, position, directive) => [...] } }`.
   * `position` is the argument's 1-based position (matching the `[N]`
   * selector that reached it). Runs in addition to (not instead of)
   * `type`/`enum`/`pattern`/etc. on the same constraint, and to
   * `and`/`or`/`not` alternatives.
   */
  evaluation?: (
    argument: unknown,
    position: number,
    directive: Directive,
  ) => Iterable<LintIssue>;
}

/**
 * `format` values for a `"string"` argument, inspired by the Temporal API.
 * The string is parsed with `temporal-polyfill`'s `Temporal.<Type>.from(value)`
 * (rejecting out-of-range fields), so the accepted syntax is exactly what
 * Temporal accepts. Each format also has a PascalCase alias.
 *
 * - `"duration"`: an ISO 8601 duration (`"P1Y2M3DT4H5M6.5S"`, `"PT30M"`).
 * - `"plain-date"` / `"PlainDate"`: `YYYY-MM-DD`.
 * - `"plain-time"` / `"PlainTime"`: `HH:mm[:ss[.fffffffff]]`.
 * - `"plain-date-time"` / `"PlainDateTime"`: `YYYY-MM-DDTHH:mm[:ss[.f]]`, no
 *   `Z` or offset.
 * - `"instant"` / `"Instant"`: a date-time with a required `Z` or offset.
 * - `"plain-year-month"` / `"PlainYearMonth"`: `YYYY-MM`.
 * - `"plain-month-day"` / `"PlainMonthDay"`: `MM-DD` or `--MM-DD`.
 * - `"zoned-date-time"` / `"ZonedDateTime"`: a date-time with an optional
 *   offset and a required IANA time zone (or offset) in brackets, e.g.
 *   `2024-02-29T10:30:00+01:00[Europe/Madrid]`.
 * - `"json"`: text `JSON.parse` accepts (any JSON value, e.g. `'{"a":1}'`).
 * - `"url"`: an absolute URL `URL.canParse()` accepts (`https://example.com/a`).
 * - `"ipv4"`: an IPv4 address, optionally with a CIDR range of 0-32
 *   (`192.0.2.1`, `10.0.0.0/8`).
 * - `"ipv6"`: an IPv6 address, optionally with a CIDR range of 0-128
 *   (`2001:db8::1`, `2001:db8::/32`).
 * - `"CIDR"`: either of the above, each with its own optional range.
 * - `"hostname"`: an RFC 1123 hostname (`api.example.com`).
 * - `"uuid"`: a canonical UUID (`123e4567-e89b-42d3-a456-426614174000`).
 * - `"email"`: an RFC 5322 `addr-spec` (`user@example.com`).
 * - `"regexp"`: a valid JavaScript regular expression source.
 * - `"semver"`: a Semantic Versioning 2.0.0 version (`1.2.3-rc.1+build.5`).
 */
export type StringFormat =
  | "json"
  | "url"
  | "ipv4"
  | "CIDR"
  | "ipv6"
  | "hostname"
  | "uuid"
  | "email"
  | "regexp"
  | "semver"
  | "duration"
  | "plain-date"
  | "PlainDate"
  | "plain-time"
  | "PlainTime"
  | "plain-date-time"
  | "PlainDateTime"
  | "instant"
  | "Instant"
  | "plain-year-month"
  | "PlainYearMonth"
  | "plain-month-day"
  | "PlainMonthDay"
  | "zoned-date-time"
  | "ZonedDateTime";

/**
 * `format` values for a `"number"` argument: a Unix epoch as an integer count
 * of seconds or milliseconds since 1970-01-01T00:00:00Z, within the range
 * `Temporal.Instant.fromEpochMilliseconds()` accepts. `"port"` is an integer
 * TCP/UDP port from 0 to 65535; `"port-well-known"` (0-1023),
 * `"port-registered"` (1024-49151) and `"port-ephemeral"` (49152-65535) narrow
 * it to one IANA range.
 */
export type NumberFormat =
  | "port"
  | "port-well-known"
  | "port-registered"
  | "port-ephemeral"
  | "epoch-seconds"
  | "EpochSeconds"
  | "unix"
  | "epoch-milliseconds"
  | "EpochMilliseconds";

/**
 * `format` values for a `"bigint"` argument: a Unix epoch in nanoseconds
 * (`Temporal.Instant.fromEpochNanoseconds()`).
 */
export type BigintFormat = "epoch-nanoseconds" | "EpochNanoseconds";

/**
 * `format` values for a `"heredoc"` argument; they apply to its `content`.
 * `"json"`: the content must be valid JSON (`JSON.parse`).
 */
export type HeredocFormat = "json";

/** A constraint on a `"string"` argument. */
export interface StringArgumentConstraint extends BaseArgumentConstraint {
  type: "string";
  format?: StringFormat;
  pattern?: string;
  flags?: string;
}

/** A constraint on a `"number"` argument. */
export interface NumberArgumentConstraint extends BaseArgumentConstraint {
  type: "number";
  format?: NumberFormat;
  gte?: number;
  gt?: number;
  lte?: number;
  lt?: number;
}

/** A constraint on a `"bigint"` argument. */
export interface BigintArgumentConstraint extends BaseArgumentConstraint {
  type: "bigint";
  format?: BigintFormat;
  gte?: bigint;
  gt?: bigint;
  lte?: bigint;
  lt?: bigint;
}

/** A constraint on a `"boolean"` argument; no further refinement beyond `type`. */
export interface BooleanArgumentConstraint extends BaseArgumentConstraint {
  type: "boolean";
}

/** A constraint on a `"null"` argument; no further refinement beyond `type`. */
export interface NullArgumentConstraint extends BaseArgumentConstraint {
  type: "null";
}

/** A constraint on a `"heredoc"` argument; `pattern`/`flags` apply to its `content`. */
export interface HeredocArgumentConstraint extends BaseArgumentConstraint {
  type: "heredoc";
  format?: HeredocFormat;
  pattern?: string;
  flags?: string;
}

/** A constraint that doesn't narrow by `type` at all — just `enum`/`or`/`and`/`not`/etc. */
export interface UntypedArgumentConstraint extends BaseArgumentConstraint {
  type?: undefined;
  /** Without a `type`, any `format` applies to whichever argument it matches. */
  format?: StringFormat | NumberFormat | BigintFormat | HeredocFormat;
}

/** A single, self-contained validation for one directive argument. */
export type ArgumentConstraint =
  | StringArgumentConstraint
  | NumberArgumentConstraint
  | BigintArgumentConstraint
  | BooleanArgumentConstraint
  | NullArgumentConstraint
  | HeredocArgumentConstraint
  | UntypedArgumentConstraint;

/** Key selecting a child directive by a path relative to its parent, e.g. `"/route"`. */
export type SubPathSelector = `/${string}`;

/**
 * Key selecting one argument by its 1-based position: either bare, e.g.
 * `"[1]"` (of the enclosing body's own path), or fused with a sub-path,
 * e.g. `"/route[2]"` (of that sub-path directly, without an intermediate
 * body) — see "Shorthand: `path[N]` as a single key" in the docs.
 */
export type ArgumentSelector = `[${number}]` | `${SubPathSelector}[${number}]`;

/**
 * The body of a rule: everything a document key (or a nested sub-path key,
 * or a rule-level `and` entry) can carry, minus the path itself — a rule is
 * always addressed by a key, never by a `path` field.
 */
export interface RuleBody {
  /** Requires the rule's own path to match at least one directive in the document. */
  required?: boolean;
  /** Caps how many times the sub-path this body belongs to occurs under its parent. */
  max?: number;
  /** Requires at least this many occurrences of the sub-path this body belongs to. */
  min?: number;
  /**
   * Number of arguments every matched directive must carry: a single number
   * for an exact count (`1` / `[1]`), or `[min, max]` for an inclusive range.
   * In the `.donly` DSL: `argsLen 1` or `argsLen 1 3`.
   */
  argsLen?: number | readonly [min: number, max: number];
  message?: string;
  severity?: RuleSeverity;
  /** Combines full, independently-addressed rules — see "`and` at the rule level". */
  and?: readonly RuleAndEntry[];
  /**
   * Alternative shapes for the *same* directive: each matched directive must
   * satisfy at least one entry (evaluated relative to that directive, so
   * `argsLen`, `[N]` and `/child` keys inside an entry all apply
   * to it). Unlike a document-level `or`, it is decided per directive, so
   * several occurrences may each pick a different alternative. `message` /
   * `severity` on this body replace the alternatives' own issues with one.
   */
  or?: readonly RuleBody[];
  /**
   * Escape hatch: arbitrary custom logic for every directive this body's
   * path matches, e.g. `{ "/path": { evaluation: (directive) => [...] } }`.
   * Runs in addition to (not instead of) `required`/`max`/`min`/`and`/
   * sub-paths/argument selectors on the same body.
   */
  evaluation?: (directive: Directive) => Iterable<LintIssue>;
  /** `"[N]"`/`"/name[N]"` keys: constraints on the argument at that 1-based position. */
  readonly [argument: ArgumentSelector]: ArgumentConstraint;
  /** `"/name"` keys: a nested rule body for that child directive. */
  readonly [subPath: SubPathSelector]: RuleBody | ArgumentConstraint;
}

/**
 * One entry of a rule-level `and`: a `RuleBody`, addressed either by its
 * own sub-path key(s) or, absent one, applying directly to its enclosing
 * key's path — see "`and` at the rule level" in the docs.
 */
export type RuleAndEntry = RuleBody;

/**
 * A rule document. Its usual shape keys each rule by a directive path
 * (optionally fused with an argument selector, e.g. `"/server/route[2]"`),
 * with each value either a full rule body or, for a fused `path[N]` key, a
 * bare argument constraint.
 *
 * The root itself also accepts `or`, `and`, and `not` directly — combining
 * whole documents as alternatives (`or`), requirements (`and`), or a
 * negation (`not`), the same way those combinators work one level down for
 * constraints and rule bodies. E.g. `{ "or": [{ "/a": {...} }, { "/b":
 * {...} }] }` accepts a document matching either shape. These compose with
 * path keys on the same object, though typically a document uses one or
 * the other.
 */
export interface LintRuleDocument {
  or?: readonly LintRuleDocument[];
  and?: readonly LintRuleDocument[];
  not?: LintRuleDocument;
  /**
   * Overrides the issues reported when none of `or`'s alternatives pass: a
   * single issue with this message (and `severity`, default `"error"`)
   * replaces the failing alternatives' own issues. Ignored without `or`.
   */
  message?: string;
  severity?: RuleSeverity;
  /**
   * Escape hatch: arbitrary custom logic for the document root itself, e.g.
   * `{ evaluation: (directive) => [...] }` — mirrors `RuleBody.evaluation`,
   * scoped to the root instead of some sub-path's matches.
   */
  evaluation?: (directive: Directive) => Iterable<LintIssue>;
  readonly [path: SubPathSelector]: RuleBody | ArgumentConstraint;
}

/**
 * The equivalent shape: an array of one-entry documents, each keyed by its
 * own path — e.g. `[{ "/server/port": { required: true } }]`.
 */
export type LintRuleArray = readonly LintRuleDocument[];
