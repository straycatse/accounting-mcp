import { describe, expect, it } from "vitest";
import { config } from "../src/config.js";
import { fortnoxOpDefs, fortnoxOpDefsInScope, fortnoxTools } from "../src/tools/fortnox/index.js";

describe("fortnox generated tool set", () => {
  it("covers all 372 spec operations with unique, valid names", () => {
    expect(fortnoxOpDefs).toHaveLength(372);
    const names = new Set(fortnoxOpDefs.map((d) => d.name));
    expect(names.size).toBe(fortnoxOpDefs.length);
    for (const name of names) {
      expect(name).toMatch(/^fortnox_[a-z0-9_]+$/);
      expect(name.length).toBeLessThanOrEqual(64);
    }
  });

  it("marks all GET-backed tools readOnly and all deletes destructive", () => {
    for (const def of fortnoxOpDefs) {
      if (def.method === "get") expect(def.readOnly, def.name).toBe(true);
      else expect(def.readOnly, def.name).toBe(false);
      if (def.method === "delete") expect(def.destructive, def.name).toBe(true);
    }
  });

  it("flags exactly the two multipart uploads and the binary downloads", () => {
    const uploads = fortnoxOpDefs.filter((d) => d.upload);
    expect(uploads.map((d) => d.path).sort()).toEqual(["/3/archive", "/3/inbox"]);
    expect(fortnoxOpDefs.filter((d) => d.binary)).toHaveLength(9);
  });

  it("gives every def a scope", () => {
    for (const def of fortnoxOpDefs) {
      expect(def.scope, def.name).toMatch(/^[a-z]+$/);
    }
  });

  it("registers only tools whose scope is in FORTNOX_SCOPES", () => {
    const granted = new Set(config.FORTNOX_SCOPES.split(/\s+/).filter(Boolean));
    expect(fortnoxOpDefsInScope.length).toBeLessThan(fortnoxOpDefs.length);
    for (const def of fortnoxOpDefsInScope) expect(granted, def.name).toContain(def.scope);
    // Modules we deliberately don't request — they need paid Fortnox add-ons.
    const dropped = new Set(fortnoxOpDefs.filter((d) => !granted.has(d.scope)).map((d) => d.scope));
    expect([...dropped].sort()).toEqual([
      "asset",
      "noxfinansinvoice",
      "profile",
      "salary",
      "timereporting",
      "warehouse",
    ]);
  });

  it("builds every in-scope def into a registrable ToolDef with a handler", () => {
    expect(fortnoxTools).toHaveLength(fortnoxOpDefsInScope.length);
    for (const tool of fortnoxTools) {
      expect(typeof tool.handler).toBe("function");
      expect(tool.input["companyId"]).toBeDefined();
    }
  });
});
