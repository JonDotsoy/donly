/**
 * Parses a `LintRuleDocument` (see `./schema.ts` and `docs/lint/rules.md`)
 * written directly in DON syntax (a `.donly` rules file) instead of JSON —
 * e.g.
 *
 * ```don
 * or {
 *   /server/port { required }
 *   /server/socket { required }
 * }
 * ```
 *
 * is the DON-syntax equivalent of:
 *
 * ```json
 * {
 *   "or": [
 *     { "/server/port": { "required": true } },
 *     { "/server/socket": { "required": true } }
 *   ]
 * }
 * ```
 *
 * The conversion is structural, not schema-aware: every directive becomes
 * an object entry keyed by its own name (a path selector like `/server`,
 * an argument selector like `[1]`, or a plain property name like
 * `required`/`type`/`message`), with its value built the same way,
 * recursively — mirroring how `DirectiveJSONEncoder`'s reducers turn a
 * directive tree into plain JSON, just specialized to this schema's shape:
 *
 * - A directive with neither args nor children is a bare boolean flag
 *   (`required` -> `true`).
 * - A directive with args but no children is a scalar (`max 1` -> `1`,
 *   `type "number"` -> `"number"`) or, with more than one arg, an array
 *   (`enum "a" "b" "c"` -> `["a", "b", "c"]`).
 * - A directive with children becomes an object built from them. A leading
 *   *string* argument alongside children is shorthand for `message` (see
 *   the `/respond "..." { min 1 }` example in `docs/lint/rules.md`).
 * - `or`/`and` become arrays, `not` a single entry — see `orAndEntry` below
 *   for how each of their own children becomes one array entry.
 *
 * Because `/*` collides with DON's own block-comment syntax, the wildcard
 * sub-path selector must be written quoted: `"/*"`. The bare root selector
 * `/` is unaffected and needs no quoting.
 */
import { DON, Directive } from "../don.js";
import { ROOT_DIRECTIVE_NAME } from "../root-directive-name.js";
import type { LintRuleDocument } from "./schema.js";

/**
 * Property names the schema recognizes at any level (rule body, argument
 * constraint, or document root). A child of `or`/`and` bearing one of these
 * names is a single-property entry addressed by that name (e.g. `type
 * "boolean"` -> `{ type: "boolean" }`); any other name is treated as an
 * anonymous grouping label for a multi-property entry (see `orAndEntry`).
 */
const KNOWN_PROPERTY_NAMES = new Set([
  "required",
  "max",
  "min",
  "minArgs",
  "maxArgs",
  "message",
  "severity",
  "type",
  "enum",
  "pattern",
  "flags",
  "format",
  "gte",
  "gt",
  "lte",
  "lt",
  "or",
  "and",
  "not",
  "evaluation",
]);

/**
 * A bare `/` is the sole exception: elsewhere it's the explicit root
 * selector (see "The root selector `/` and the wildcard `/*`" in the
 * docs), but as an `or`/`and` child it's reserved as the anonymous
 * grouping marker (see `orAndEntry`) — a real root-selector alternative is
 * vanishingly rare next to a multi-property alternative, so `/` alone
 * favors the latter.
 */
const isPathOrArgumentSelector = (name: string): boolean =>
  (name.startsWith("/") && name !== "/") || /^\[\d+\]$/.test(name);

/**
 * `or`/`and`/`not`'s own value is always an array (or a single entry for
 * `not`) — there's no room inside it for a sibling `message`, unlike an
 * ordinary sub-path/property child, whose `message` shorthand lives
 * *inside* its own returned object (handled generically below, since
 * `objectFromChildren` recurses into every child with children of its
 * own). So `or 'msg' { ... }` / `and 'msg' { ... }` / `not 'msg' { ... }`
 * escapes its leading string argument one level up instead, as `message`
 * on the *enclosing* object — the same place a sibling `message` child
 * would put it.
 */
const COMBINATOR_NAMES = new Set(["or", "and", "not"]);

/** A directive's own children built into a plain object, keyed by name. */
const objectFromChildren = (directive: Directive): Record<string, unknown> => {
  const obj: Record<string, unknown> = {};

  for (const child of directive.children) {
    const key = String(child.name);
    const value = convertValue(child);
    if (key in obj) {
      const existing = obj[key];
      obj[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      obj[key] = value;
    }

    if (COMBINATOR_NAMES.has(key) && !("message" in obj)) {
      const [firstArg, ...restArgs] = child.args;
      if (typeof firstArg === "string" && restArgs.length === 0) {
        obj.message = firstArg;
      }
    }
  }

  const [firstArg, ...restArgs] = directive.args;
  if (
    typeof firstArg === "string" &&
    restArgs.length === 0 &&
    !("message" in obj)
  ) {
    obj.message = firstArg;
  }

  return obj;
};

/**
 * One entry of an `or`/`and` array (or `not`'s sole entry): a child
 * directive named `/path`, `[N]`, or a known property (`type`, `required`,
 * etc.) wraps itself as `{ [name]: value }` — the common case, one property
 * per alternative. Any other name — conventionally a bare `/`, annotated
 * with a `# comment` above it for readers — is an anonymous grouping label
 * whose own children (and leading-string-arg-as-`message` shorthand)
 * become a multi-property alternative directly, discarding the label
 * itself — e.g. `/ { type "number"; gt 1024; lte 65535 }` -> `{ type:
 * "number", gt: 1024, lte: 65535 }`.
 */
const orAndEntry = (child: Directive): Record<string, unknown> => {
  const name = String(child.name);
  if (isPathOrArgumentSelector(name) || KNOWN_PROPERTY_NAMES.has(name)) {
    return { [name]: convertValue(child) };
  }
  return objectFromChildren(child);
};

/** Properties whose value is always an array, even given a single argument. */
const ALWAYS_ARRAY_NAMES = new Set(["enum"]);

const scalarValue = (directive: Directive, alwaysArray: boolean): unknown => {
  if (directive.args.length === 0) return true;
  if (directive.args.length === 1 && !alwaysArray) return directive.args[0];
  return [...directive.args];
};

const convertValue = (directive: Directive): unknown => {
  const name = String(directive.name);

  if (name === "or" || name === "and") {
    return directive.children.map(orAndEntry);
  }
  if (name === "not") {
    const [only] = directive.children;
    return only ? orAndEntry(only) : {};
  }
  if (directive.children.length === 0) {
    return scalarValue(directive, ALWAYS_ARRAY_NAMES.has(name));
  }
  return objectFromChildren(directive);
};

/**
 * Parses a `.donly` rules document (DON syntax) into the same
 * `LintRuleDocument` shape a `.json` rules file decodes to, ready to pass
 * to `lintSchema`/`lint`.
 */
export const parseLintRulesDonly = (source: string): LintRuleDocument => {
  const parsed = DON.parse(source);
  const root =
    parsed.name === ROOT_DIRECTIVE_NAME
      ? parsed
      : new Directive(ROOT_DIRECTIVE_NAME, [], [parsed]);

  return objectFromChildren(root) as LintRuleDocument;
};
