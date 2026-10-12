/**
 * Validators for the dependency-free `format` values of `"string"` (and
 * `"number"`, for `port`) arguments. Each takes the raw argument and returns
 * `false` for anything that is not the expected kind of value.
 */

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

/** `URL.canParse`: any absolute URL the WHATWG URL parser accepts. */
export const isUrl = (value: unknown): boolean => {
  const text = asString(value);
  return text !== undefined && URL.canParse(text);
};

// Four dot-separated decimal groups of 1-3 digits, without leading zeros.
const IPV4_SHAPE_RE = /^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/;

// A CIDR prefix length: decimal without leading zeros (bounded with Number).
const PREFIX_RE = /^(?:0|[1-9]\d{0,2})$/;

/**
 * Splits an optional CIDR range off `text` (`<address>/<range>`): returns the
 * address, or `undefined` when there is more than one `/` or the range is not
 * an integer from 0 to `max`.
 */
const splitRange = (text: string, max: number): string | undefined => {
  const [address, prefix, ...rest] = text.split("/");
  if (rest.length > 0 || address === undefined) return undefined;
  if (prefix === undefined) return address;
  return PREFIX_RE.test(prefix) && Number(prefix) <= max ? address : undefined;
};

/**
 * A dotted-quad IPv4 address with no range. The shape is checked with a
 * regular expression, then the value is split on `.` and every part,
 * converted with `Number(part)`, must fit in one byte (0-255).
 */
const isIpv4Address = (text: string): boolean =>
  IPV4_SHAPE_RE.test(text) &&
  text.split(".").every((part) => Number(part) <= 255);

/**
 * An IPv4 address, optionally followed by a CIDR range (`<ip>/<range>`, with
 * the range from 0 to 32).
 */
export const isIpv4 = (value: unknown): boolean => {
  const text = asString(value);
  const address = text === undefined ? undefined : splitRange(text, 32);
  return address !== undefined && isIpv4Address(address);
};

/** A dotted quad: the IPv4 tail of an IPv6 address. */
const isDottedQuad = isIpv4Address;

const IPV6_GROUP_RE = /^[0-9a-fA-F]{1,4}$/;

/**
 * Splits one side of an IPv6 address into its `:`-separated parts and
 * returns how many 16-bit groups they stand for, or `undefined` if a part is
 * invalid. Every part must be 1-4 hex digits; only the very last part of the
 * whole address (`allowQuad`) may instead be a dotted-quad IPv4, which counts
 * as two groups.
 */
const countIpv6Groups = (
  side: string,
  allowQuad: boolean,
): number | undefined => {
  if (side === "") return 0;
  const parts = side.split(":");
  let groups = 0;
  for (const [index, part] of parts.entries()) {
    if (IPV6_GROUP_RE.test(part)) {
      groups += 1;
    } else if (allowQuad && index === parts.length - 1 && isDottedQuad(part)) {
      groups += 2;
    } else {
      return undefined;
    }
  }
  return groups;
};

/**
 * An IPv6 address in any textual form (`::1`, `2001:db8::1`,
 * `::ffff:1.2.3.4`), without brackets, a zone id or a range. It is validated
 * by its parts: at most one `::`; each remaining part is 1-4 hex digits (the
 * last one may be an IPv4 dotted quad worth two groups); and the address has
 * exactly 8 groups, or fewer than 8 when a `::` stands for the missing zero
 * groups.
 */
const isIpv6Address = (text: string): boolean => {
  const gap = text.indexOf("::");
  if (gap === -1) return countIpv6Groups(text, true) === 8;
  if (text.lastIndexOf("::") !== gap) return false;
  const head = countIpv6Groups(text.slice(0, gap), false);
  const tail = countIpv6Groups(text.slice(gap + 2), true);
  return head !== undefined && tail !== undefined && head + tail <= 7;
};

/**
 * An IPv6 address, optionally followed by a CIDR range (`<ip>/<range>`, with
 * the range from 0 to 128).
 */
export const isIpv6 = (value: unknown): boolean => {
  const text = asString(value);
  const address = text === undefined ? undefined : splitRange(text, 128);
  return address !== undefined && isIpv6Address(address);
};

/**
 * CIDR notation for either family: an IPv4 or IPv6 address with an optional
 * range (0-32 for IPv4, 0-128 for IPv6). The range is never required.
 */
export const isCidr = (value: unknown): boolean =>
  isIpv4(value) || isIpv6(value);

const HOST_LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

/**
 * RFC 1123 hostname: dot-separated labels of 1-63 letters, digits or hyphens
 * (not starting or ending with a hyphen), at most 253 characters, optionally
 * ending in the root dot. The last label can't be all digits, so an IPv4
 * address is not a hostname.
 */
export const isHostname = (value: unknown): boolean => {
  const text = asString(value);
  if (text === undefined) return false;
  const name = text.endsWith(".") ? text.slice(0, -1) : text;
  if (name.length === 0 || name.length > 253) return false;
  const labels = name.split(".");
  return (
    labels.every((label) => HOST_LABEL_RE.test(label)) &&
    !/^\d+$/.test(labels[labels.length - 1]!)
  );
};

/** A TCP/UDP port: an integer `number` from 0 to 65535. */
export const isPort = (value: unknown): boolean =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= 65535;

const isPortInRange = (value: unknown, min: number, max: number): boolean =>
  isPort(value) && (value as number) >= min && (value as number) <= max;

/** A well-known (system) port: an integer `number` from 0 to 1023. */
export const isPortWellKnown = (value: unknown): boolean =>
  isPortInRange(value, 0, 1023);

/** A registered port: an integer `number` from 1024 to 49151. */
export const isPortRegistered = (value: unknown): boolean =>
  isPortInRange(value, 1024, 49151);

/** An ephemeral (dynamic/private) port: an integer `number` from 49152 to 65535. */
export const isPortEphemeral = (value: unknown): boolean =>
  isPortInRange(value, 49152, 65535);

const UUID_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

/**
 * Canonical 8-4-4-4-12 UUID (RFC 9562), any case: versions 1-8 with the RFC
 * variant, plus the nil and max UUIDs.
 */
export const isUuid = (value: unknown): boolean => {
  const text = asString(value);
  return text !== undefined && UUID_RE.test(text);
};

// RFC 5322 `atext`, `qtext` and `quoted-pair`, without obsolete syntax,
// comments or folding whitespace.
const ATEXT = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]";
const DOT_ATOM = `${ATEXT}+(?:\\.${ATEXT}+)*`;
const QUOTED_STRING = '"(?:[\\x21\\x23-\\x5B\\x5D-\\x7E ]|\\\\[\\x20-\\x7E])*"';
const LOCAL_PART_RE = new RegExp(`^(?:${DOT_ATOM}|${QUOTED_STRING})$`);

/**
 * RFC 5322 `addr-spec` (`local-part@domain`): a dot-atom or quoted-string
 * local part, and a domain that is a hostname or an address literal
 * (`[192.0.2.1]`, `[IPv6:::1]`). Also enforces the RFC 5321 length limits
 * (64 for the local part, 254 overall). Comments, folding whitespace and the
 * obsolete syntax of RFC 5322 are not accepted.
 */
export const isEmail = (value: unknown): boolean => {
  const text = asString(value);
  if (text === undefined || text.length > 254) return false;
  const at = text.lastIndexOf("@");
  if (at < 1) return false;
  const local = text.slice(0, at);
  const domain = text.slice(at + 1);
  if (local.length > 64 || !LOCAL_PART_RE.test(local)) return false;
  if (domain.startsWith("[") && domain.endsWith("]")) {
    const literal = domain.slice(1, -1);
    return literal.startsWith("IPv6:")
      ? isIpv6Address(literal.slice("IPv6:".length))
      : isIpv4Address(literal);
  }
  return isHostname(domain) && !domain.endsWith(".");
};

/** A string that compiles as a JavaScript `RegExp` source. */
export const isRegexp = (value: unknown): boolean => {
  const text = asString(value);
  if (text === undefined) return false;
  try {
    new RegExp(text);
    return true;
  } catch {
    return false;
  }
};

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/** A Semantic Versioning 2.0.0 version, e.g. `1.2.3-rc.1+build.5` (no `v`). */
export const isSemver = (value: unknown): boolean => {
  const text = asString(value);
  return text !== undefined && SEMVER_RE.test(text);
};
