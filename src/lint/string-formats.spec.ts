import { describe, test, expect } from "bun:test";
import { lintSchema } from "./lint-schema";
import type { ArgumentConstraint, LintRuleDocument } from "./schema";

/** Quotes `text` as a DON string, using whichever quote it doesn't contain. */
const quote = (text: string): string =>
  text.includes("'") ? `"${text}"` : `'${text}'`;

const check = (format: string, literal: string): boolean =>
  lintSchema(`d ${literal}`, {
    "/d": {
      "[1]": { type: "string", format } as ArgumentConstraint,
    },
  }).length === 0;

const cases: Record<string, { accept: string[]; reject: string[] }> = {
  url: {
    accept: [
      "https://example.com",
      "http://localhost:8080/a/b?c=d#e",
      "ftp://user:pw@host/file",
      "file:///etc/hosts",
      "mailto:user@example.com",
      "https://[::1]:3000/",
      "https://例え.jp/パス",
    ],
    reject: ["", "example.com", "/relative/path", "//host/path", "http://", "http://exa mple.com", "https://host:99999", "://x"],
  },
  ipv4: {
    accept: [
      "10.0.0.0/8",
      "192.168.1.0/24",
      "1.2.3.4/32",
      "0.0.0.0/0",
      "1.2.3.4/0","0.0.0.0", "127.0.0.1", "192.168.1.254", "255.255.255.255", "10.0.0.1"],
    reject: ["", "1.2.3.4/33", "1.2.3.4/99", "1.2.3.4/100", "1.2.3.4/", "1.2.3.4/-1", "1.2.3.4/08", "1.2.3.4/1.5", "1.2.3.4/a", "1.2.3.4/24/8", "/24", "256.0.0.1/24", "1.2.3/24", "1.2.3.4 /24", "1.2.3.4/ 24", "1.2.3.4/0x10", "256.0.0.1", "1.2.3", "1.2.3.4.5", "01.2.3.4", "1.2.3.04", "1.2.3.-4", " 1.2.3.4", "1.2.3.4 ", "a.b.c.d", "::1", "1..3.4", "999.999.999.999", "255.255.255.256", "1.256.3.4", "1.2.300.4", "1000.1.1.1"],
  },
  ipv6: {
    accept: [
      "::",
      "::1",
      "2001:db8::1",
      "2001:0db8:0000:0000:0000:0000:0000:0001",
      "fe80::1",
      "1::",
      "FE80::ABCD",
      "0:0:0:0:0:0:0:0",
      "1:2:3:4:5:6:7:8",
      "1:2:3:4:5:6:7::",
      "::2:3:4:5:6:7:8",
      "fe80::1ff:fe23:4567:890a",
      "::1.2.3.4",
      "::ffff:192.0.2.1",
      "1:2:3:4:5:6:1.2.3.4",
      "1:2:3:4:5::1.2.3.4",
      "64:ff9b::192.0.2.33",
      "::1/128",
      "2001:db8::/32",
      "::/0",
      "fe80::1/64",
      "::ffff:1.2.3.4/96",
      "1:2:3:4:5:6:7:8/128",
    ],
    reject: [
      "",
      "1",
      ":",
      ":::",
      "2001:db8:::1",
      "12345::1",
      "2001:db8",
      "1:2:3:4:5:6:7",
      "1:2:3:4:5:6:7:8:9",
      "1::2:3:4:5:6:7:8",
      "1:2:3:4:5:6:7:8::",
      "::1:2:3:4:5:6:7:8",
      ":1:2:3:4:5:6:7",
      "1:2:3:4:5:6:7:",
      "[::1]",
      "::1%eth0",
      "g::1",
      " ::1",
      "::1 ",
      "192.0.2.1",
      "1::2::3",
      "1.2.3.4::",
      "::1.2.3.4:1",
      "1:2:3:4:5:6:7:1.2.3.4",
      "::ffff:256.0.0.1",
      "::1.2.3.04",
      "::1.2.3",
      "::1.2.3.4.5",
      "::0x1.2.3.4",
      "::1/129",
      "::1/999",
      "::1/",
      "::1/-1",
      "::1/064",
      "::1/1.5",
      "::1/a",
      "::1/64/8",
      "/64",
      "::1 /64",
      "1.2.3.4/24 ",
    ],
  },
  CIDR: {
    accept: [
      "10.0.0.0/8",
      "192.168.1.0/24",
      "1.2.3.4/32",
      "0.0.0.0/0",
      "1.2.3.4",
      "2001:db8::/32",
      "::/0",
      "::1/128",
      "fe80::/10",
      "2001:db8::1",
      "::ffff:1.2.3.4/96",
    ],
    reject: [
      "",
      "1.2.3.4/33",
      "::1/129",
      "2001:db8::/129",
      "1.2.3.4/64",
      "256.0.0.1/24",
      "1.2.3/24",
      "10.0.0.0/",
      "::1/",
      "/24",
      "/64",
      "10.0.0.0/8/8",
      "2001:db8:::/32",
      "10.0.0.0/08",
      "fe80::/010",
      "example.com/24",
      "10.0.0.0 /8",
    ],
  },
  hostname: {
    accept: ["localhost", "example.com", "a.b.c.example.com", "my-host", "host-1.example.com", "EXAMPLE.COM", "1host.example.com", "example.com.", "x", "a".repeat(63) + ".com"],
    reject: ["", ".", ".example.com", "example..com", "-host.com", "host-.com", "ho_st.com", "ho st.com", "host.com/path", "host:80", "1.2.3.4", "example.123", "a".repeat(64) + ".com", `${"a".repeat(63)}.`.repeat(4) + "com"],
  },
  uuid: {
    accept: [
      "123e4567-e89b-42d3-a456-426614174000",
      "123E4567-E89B-42D3-A456-426614174000",
      "00000000-0000-0000-0000-000000000000",
      "ffffffff-ffff-ffff-ffff-ffffffffffff",
      "550e8400-e29b-41d4-a716-446655440000",
      "018f0b5e-7c3a-7abc-8def-0123456789ab",
    ],
    reject: ["", "123e4567e89b42d3a456426614174000", "123e4567-e89b-42d3-a456-42661417400", "123e4567-e89b-42d3-a456-4266141740000", "123e4567-e89b-02d3-a456-426614174000", "123e4567-e89b-92d3-a456-426614174000", "123e4567-e89b-42d3-c456-426614174000", "g23e4567-e89b-42d3-a456-426614174000", "{123e4567-e89b-42d3-a456-426614174000}", "urn:uuid:123e4567-e89b-42d3-a456-426614174000"],
  },
  email: {
    accept: [
      "user@example.com",
      "first.last@example.com",
      "user+tag@example.co.uk",
      "o'brien@example.com",
      "a@b.c",
      "x@localhost",
      "!#$%&'*+/=?^_`{|}~-@example.com",
      '"quoted local"@example.com',
      '"a\\"b"@example.com',
      '"a@b"@example.com',
      "user@[192.0.2.1]",
      "user@[IPv6:2001:db8::1]",
      "USER@EXAMPLE.COM",
    ],
    reject: [
      "",
      "user",
      "@example.com",
      "user@",
      "user@@example.com",
      "a@b@example.com",
      "user@example..com",
      ".user@example.com",
      "user.@example.com",
      "us..er@example.com",
      "user name@example.com",
      "user@exa mple.com",
      "user@-example.com",
      "user@example.com.",
      "user@[999.0.0.1]",
      "user@[IPv6:nope]",
      "user@[192.0.2.1",
      "<user@example.com>",
      "User <user@example.com>",
      "user(comment)@example.com",
      "üser@example.com",
      `${"a".repeat(65)}@example.com`,
      `a@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.${"e".repeat(63)}.com`,
    ],
  },
  regexp: {
    accept: ["^a+$", "[a-z]{2,}", "(?:x|y)", "\\d+\\.\\d+", "(?<name>a)\\k<name>", ".*", "", "\\u{1F600}"],
    reject: ["(", "[a-z", "*a", "a{2,1}", "(?<n>a)(?<n>b)", "(?<=a"],
  },
  semver: {
    accept: ["0.0.0", "1.2.3", "10.20.30", "1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-0.3.7", "1.0.0-x.7.z.92", "1.0.0-alpha+001", "1.0.0+20130313144700", "1.0.0-beta+exp.sha.5114f85", "1.0.0-rc.1+build.5", "1.0.0-a-b"],
    reject: ["", "1", "1.2", "1.2.3.4", "01.2.3", "1.02.3", "1.2.03", "v1.2.3", "1.2.3-", "1.2.3+", "1.2.3-01", "1.2.3-alpha..1", "1.2.3-alpha_1", "1.2.3+build..1", "-1.2.3", "1.2.-3", " 1.2.3", "1.2.3 "],
  },
};

describe("string formats", () => {
  for (const [format, { accept, reject }] of Object.entries(cases)) {
    test(`${format} accepts`, () => {
      for (const value of accept)
        expect([value, check(format, quote(value))]).toEqual([value, true]);
    });
    test(`${format} rejects`, () => {
      for (const value of reject)
        expect([value, check(format, quote(value))]).toEqual([value, false]);
    });
    test(`${format} rejects non-string arguments`, () => {
      for (const literal of ["123", "123n", "true"])
        expect([literal, check(format, literal)]).toEqual([literal, false]);
    });
  }

  test("a quoted number is a string, not a port", () => {
    expect(check("semver", "'1.2.3'")).toBe(true);
  });
});

describe("ipv4 with an out-of-range octet", () => {
  test('validates "256.0.0.1" without throwing and reports one issue', () => {
    const rule = {
      "/d": { "[1]": { type: "string", format: "ipv4" } },
    } satisfies LintRuleDocument;
    const run = () => lintSchema("d '256.0.0.1'", rule);

    // Only the outcome matters here: validation runs to completion and the
    // value is flagged, rather than crashing on the invalid octet.
    expect(run).not.toThrow();
    const issues = run();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error" });
  });
});

describe("port format", () => {
  const port = (literal: string, extra = {}) =>
    lintSchema(`d ${literal}`, {
      "/d": {
        "[1]": { type: "number", format: "port", ...extra } as ArgumentConstraint,
      },
    }).length === 0;

  test("accepts integers from 0 to 65535", () => {
    for (const v of ["0", "1", "22", "80", "8080", "65535"])
      expect([v, port(v)]).toEqual([v, true]);
  });

  test("rejects out of range, decimals, strings and bigint", () => {
    for (const v of ["-1", "65536", "99999", "1.5", "'8080'", '"80"', "80n", "true"])
      expect([v, port(v)]).toEqual([v, false]);
  });

  test("combines with gte to forbid privileged ports", () => {
    expect(port("8080", { gte: 1024 })).toBe(true);
    expect(port("80", { gte: 1024 })).toBe(false);
  });

  test("works inside a block next to other directives", () => {
    const rule = {
      "/server/listen": { "[1]": { type: "number", format: "port" } },
      "/server/host": { "[1]": { type: "string", format: "hostname" } },
      "/server/id": { "[1]": { type: "string", format: "uuid" } },
      "/server/contact": { "[1]": { type: "string", format: "email" } },
      "/server/version": { "[1]": { type: "string", format: "semver" } },
    } satisfies LintRuleDocument;
    const doc = (port: string, host: string) => `name "x"
server {
  listen ${port}
  host '${host}'
  id '123e4567-e89b-42d3-a456-426614174000'
  contact 'ops@example.com'
  version '1.2.3'
}`;
    expect(lintSchema(doc("8080", "api.example.com"), rule)).toHaveLength(0);
    expect(lintSchema(doc("70000", "-bad-"), rule)).toHaveLength(2);
  });

  test("works without a type", () => {
    expect(lintSchema("d 8080", { "/d": { "[1]": { format: "port" } } })).toHaveLength(0);
    expect(lintSchema("d 99999", { "/d": { "[1]": { format: "port" } } })).toHaveLength(1);
    expect(lintSchema("d '::1'", { "/d": { "[1]": { format: "ipv6" } } })).toHaveLength(0);
  });
});

describe("port range formats", () => {
  const check = (format: string, literal: string) =>
    lintSchema(`d ${literal}`, {
      "/d": { "[1]": { type: "number", format } as ArgumentConstraint },
    }).length === 0;

  const cases: Record<string, [string[], string[]]> = {
    "port-well-known": [
      ["0", "80", "1023"],
      ["1024", "65535", "-1", "1.5", "'80'"],
    ],
    "port-registered": [
      ["1024", "8080", "49151"],
      ["0", "1023", "49152", "65536", "1.5", "'8080'"],
    ],
    "port-ephemeral": [
      ["49152", "50000", "65535"],
      ["0", "49151", "65536", "1.5", "'50000'"],
    ],
  };

  for (const [format, [valid, invalid]] of Object.entries(cases)) {
    test(`${format} accepts only its range`, () => {
      for (const v of valid) expect([v, check(format, v)]).toEqual([v, true]);
      for (const v of invalid) expect([v, check(format, v)]).toEqual([v, false]);
    });
  }

  test("works inside a block next to other directives and without a type", () => {
    const rule = {
      "/server/listen": { "[1]": { type: "number", format: "port-registered" } },
      "/server/host": { "[1]": { type: "string", format: "hostname" } },
    } satisfies LintRuleDocument;
    const doc = (port: string) => `name "x"
server {
  listen ${port}
  host 'api.example.com'
}`;
    expect(lintSchema(doc("8080"), rule)).toHaveLength(0);
    expect(lintSchema(doc("80"), rule)).toHaveLength(1);
    expect(
      lintSchema("d 443", { "/d": { "[1]": { format: "port-well-known" } } }),
    ).toHaveLength(0);
  });

  test("default message names the range", () => {
    expect(
      lintSchema("d 8080", {
        "/d": { "[1]": { type: "number", format: "port-well-known" } },
      })[0]?.message,
    ).toBe(
      "argument at position 1 must be a valid port-well-known: an integer well-known port from 0 to 1023 (e.g. 443)",
    );
  });
});

describe("default message for a failing format", () => {
  const message = (doc: string, constraint: object): string | undefined =>
    lintSchema(doc, {
      "/d": { "[1]": constraint as ArgumentConstraint },
    })[0]?.message;

  test("names the format, what a valid value is and an example", () => {
    expect(message("d '256.0.0.1'", { type: "string", format: "ipv4" })).toBe(
      "argument at position 1 must be a valid ipv4: an IPv4 address (e.g. 192.0.2.1)",
    );
    expect(message("d 70000", { type: "number", format: "port" })).toBe(
      "argument at position 1 must be a valid port: an integer port from 0 to 65535 (e.g. 8080)",
    );
    expect(message("d 'nope'", { type: "string", format: "plain-date" })).toBe(
      "argument at position 1 must be a valid plain-date: an ISO 8601 calendar date (YYYY-MM-DD) (e.g. 2024-02-29)",
    );
  });

  test("IP formats only mention a range when the value used one", () => {
    const ipv4 = { type: "string", format: "ipv4" };
    expect(message("d '256.0.0.1'", ipv4)).toBe(
      "argument at position 1 must be a valid ipv4: an IPv4 address (e.g. 192.0.2.1)",
    );
    expect(message("d '10.0.0.0/33'", ipv4)).toBe(
      "argument at position 1 must be a valid ipv4: an IPv4 address with a range from /0 to /32 (e.g. 10.0.0.0/8)",
    );
    expect(message("d '256.0.0.1/24'", ipv4)).toContain("with a range from /0 to /32");
    expect(message("d '10.0.0.0/'", ipv4)).toContain("with a range from /0 to /32");

    const ipv6 = { type: "string", format: "ipv6" };
    expect(message("d 'nope'", ipv6)).toBe(
      "argument at position 1 must be a valid ipv6: an IPv6 address (e.g. 2001:db8::1)",
    );
    expect(message("d '::1/129'", ipv6)).toBe(
      "argument at position 1 must be a valid ipv6: an IPv6 address with a range from /0 to /128 (e.g. 2001:db8::/32)",
    );
  });

  test("CIDR names the family's own range once a range is used", () => {
    const cidr = { type: "string", format: "CIDR" };
    expect(message("d 'nope'", cidr)).toBe(
      "argument at position 1 must be a valid CIDR: an IPv4 or IPv6 address (e.g. 192.0.2.1 or 2001:db8::1)",
    );
    expect(message("d '10.0.0.0/33'", cidr)).toBe(
      "argument at position 1 must be a valid CIDR: an IPv4 address with a range from /0 to /32 (e.g. 10.0.0.0/8)",
    );
    expect(message("d '2001:db8::/129'", cidr)).toBe(
      "argument at position 1 must be a valid CIDR: an IPv6 address with a range from /0 to /128 (e.g. 2001:db8::/32)",
    );
  });

  test("uses the format name the rule wrote, aliases included", () => {
    expect(message("d 'x'", { type: "string", format: "PlainDate" })).toContain(
      "must be a valid PlainDate:",
    );
    expect(message("d 'x'", { type: "string", format: "CIDR" })).toContain(
      "must be a valid CIDR: an IPv4 or IPv6 address (e.g.",
    );
  });

  test("every known format has a description and an example", () => {
    const formats = [
      "json", "url", "ipv4", "ipv6", "CIDR", "hostname", "port", "port-well-known", "port-registered", "port-ephemeral", "uuid",
      "email", "regexp", "semver", "duration", "plain-date", "PlainDate",
      "plain-time", "PlainTime", "plain-date-time", "PlainDateTime",
      "instant", "Instant", "plain-year-month", "PlainYearMonth",
      "plain-month-day", "PlainMonthDay", "zoned-date-time", "ZonedDateTime",
      "epoch-seconds", "EpochSeconds", "unix", "epoch-milliseconds",
      "EpochMilliseconds", "epoch-nanoseconds", "EpochNanoseconds",
    ];
    for (const format of formats) {
      const text = message("d '('", { format });
      expect([format, text]).toEqual([
        format,
        expect.stringMatching(
          new RegExp(`^argument at position 1 must be a valid ${format}: .+ \\(e\\.g\\. .+\\)$`),
        ),
      ]);
    }
  });

  test("falls back to the type message when the type itself is wrong", () => {
    expect(message("d 5", { type: "string", format: "ipv4" })).toBe(
      "argument at position 1 must be of type string",
    );
  });

  test("works without a type", () => {
    expect(message("d 'nope'", { format: "uuid" })).toContain(
      "must be a valid uuid: a canonical UUID",
    );
  });

  test("never echoes the offending value", () => {
    const text = message("d 'secret-token-123'", { type: "string", format: "email" });
    expect(text).not.toContain("secret-token-123");
  });

  test("a rule's own message still wins", () => {
    expect(
      message("d 'x'", { type: "string", format: "ipv4", message: "bad ip" }),
    ).toBe("bad ip");
  });

  test("an unknown format is reported as such", () => {
    expect(message("d 'x'", { type: "string", format: "nope" })).toBe(
      'argument at position 1 has an unknown format "nope"',
    );
  });

  test("a failing pattern is not blamed on the format", () => {
    expect(
      message("d '2024-02-29'", { type: "string", format: "plain-date", pattern: "^1999" }),
    ).toBe("argument at position 1 must be of type string");
  });
});
