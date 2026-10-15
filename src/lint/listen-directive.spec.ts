import { describe, expect, test } from "bun:test";
import { lintSchema } from "./lint-schema.js";
import { parseLintRulesDonly } from "./rules-dsl.js";

const rules = parseLintRulesDonly(`
/listen {
  message "listen: formato inválido (ver docs)"
  or {
    # listen 0
    / {
      minArgs 1
      maxArgs 1
      [1] {
        type "number"
        format "port"
      }
      /ssl { max 0 }
    }
    # listen http | listen https
    / {
      minArgs 1
      maxArgs 1
      [1] {
        type "string"
        enum "http" "https"
      }
      /ssl { max 0 }
    }
    # listen http 0
    / {
      minArgs 2
      maxArgs 2
      [1] {
        type "string"
        enum "http" "https"
      }
      [2] {
        type "number"
        format "port"
      }
      /ssl { max 0 }
    }
    # listen https 127.0.0.1 8080 { ssl { ... } }
    / {
      minArgs 3
      maxArgs 3
      [1] {
        type "string"
        enum "http" "https"
      }
      [2] {
        or {
          / {
            type "string"
            format "ipv4"
          }
          / {
            type "string"
            format "hostname"
          }
        }
      }
      [3] {
        type "number"
        format "port"
      }
      /ssl { max 1 }
    }
  }
}
`);

const ok = [
  "listen 0",
  "listen http",
  "listen http 0",
  "listen http 127.0.0.1 8080",
  "listen https",
  "listen https 127.0.0.1 0",
  "listen https 127.0.0.1 8080",
  "listen https 127.0.0.1 8080 { ssl { cert a\n key b } }",
  "listen https localhost 8080",
];
const bad = [
  "listen",
  "listen 70000",
  "listen ftp",
  "listen http 0 1",
  "listen http 127.0.0.1 8080 9",
  "listen http 0 { ssl { cert a } }",
  "listen 0x1F", // DON lo parsea como string
  "listen null",
];

describe("listen con múltiples formatos", () => {
  for (const src of ok) {
    test(`acepta ${JSON.stringify(src)}`, () => {
      expect(lintSchema(src, rules)).toEqual([]);
    });
  }
  for (const src of bad) {
    test(`rechaza ${JSON.stringify(src)}`, () => {
      expect(lintSchema(src, rules).length).toBeGreaterThan(0);
    });
  }
  test("cada listen elige su propia alternativa", () => {
    expect(lintSchema("listen 0\nlisten https 127.0.0.1 8080\nlisten http", rules)).toEqual([]);
    expect(lintSchema("listen 0\nlisten ftp", rules)).toHaveLength(1);
  });
  test("sin message se reporta la alternativa más cercana", () => {
    const r = parseLintRulesDonly(`/listen {
 or {
 / {
 maxArgs 1
 }
 / {
 minArgs 5
 }
 }
}`);
    expect(lintSchema("listen a b c", r)[0]?.message).toContain("at most 1");
  });
});
