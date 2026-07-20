import { describe, expect, it, vi } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { config } from "../src/config.js";
import { registerTools, textResult, type ToolDef } from "../src/tools/registry.js";

const defs: ToolDef[] = [
  {
    name: "read_tool",
    title: "Read",
    description: "reads",
    input: {},
    readOnly: true,
    handler: async () => textResult("read"),
  },
  {
    name: "write_tool",
    title: "Write",
    description: "writes",
    input: {},
    readOnly: false,
    destructive: true,
    handler: async () => textResult("write"),
  },
];

function fakeServer() {
  return { registerTool: vi.fn() } as unknown as McpServer & { registerTool: ReturnType<typeof vi.fn> };
}

describe("registerTools write toggle", () => {
  it("omits mutating tools when writes are disabled", () => {
    vi.spyOn(config, "BOKIO_ALLOW_WRITES", "get").mockReturnValue(false as never);
    const server = fakeServer();
    registerTools(server, { userId: "u1" }, defs);
    const names = server.registerTool.mock.calls.map((c) => c[0]);
    expect(names).toEqual(["read_tool"]);
  });

  it("registers mutating tools with annotations when writes are enabled", () => {
    vi.spyOn(config, "BOKIO_ALLOW_WRITES", "get").mockReturnValue(true as never);
    const server = fakeServer();
    registerTools(server, { userId: "u1" }, defs);
    const names = server.registerTool.mock.calls.map((c) => c[0]);
    expect(names).toEqual(["read_tool", "write_tool"]);

    const writeMeta = server.registerTool.mock.calls[1]![1];
    expect(writeMeta.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
    });
    const readMeta = server.registerTool.mock.calls[0]![1];
    expect(readMeta.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
  });
});

describe("registerTools per-provider write toggle", () => {
  const providerDefs: ToolDef[] = [
    { ...defs[0]!, name: "bokio_read" },
    { ...defs[1]!, name: "bokio_write" },
    { ...defs[0]!, name: "fortnox_read" },
    { ...defs[1]!, name: "fortnox_write" },
  ];

  it("gates bokio and fortnox writes independently", () => {
    vi.spyOn(config, "BOKIO_ALLOW_WRITES", "get").mockReturnValue(true as never);
    vi.spyOn(config, "FORTNOX_ALLOW_WRITES", "get").mockReturnValue(false as never);
    const server = fakeServer();
    registerTools(server, { userId: "u1" }, providerDefs);
    const names = server.registerTool.mock.calls.map((c) => c[0]);
    expect(names).toEqual(["bokio_read", "bokio_write", "fortnox_read"]);
  });

  it("gates fortnox writes on FORTNOX_ALLOW_WRITES alone", () => {
    vi.spyOn(config, "BOKIO_ALLOW_WRITES", "get").mockReturnValue(false as never);
    vi.spyOn(config, "FORTNOX_ALLOW_WRITES", "get").mockReturnValue(true as never);
    const server = fakeServer();
    registerTools(server, { userId: "u1" }, providerDefs);
    const names = server.registerTool.mock.calls.map((c) => c[0]);
    expect(names).toEqual(["bokio_read", "fortnox_read", "fortnox_write"]);
  });
});

describe("bokio tool set", () => {
  it("covers all 85 spec operations and every tool name is unique", async () => {
    const { bokioOpDefs, bokioTools } = await import("../src/tools/bokio/index.js");
    expect(bokioOpDefs).toHaveLength(85);
    const names = new Set(bokioTools.map((t) => t.name));
    expect(names.size).toBe(bokioTools.length);
    for (const name of names) expect(name).toMatch(/^bokio_[a-z0-9_]+$/);
  });

  it("marks all GET-backed tools readOnly and all deletes destructive", async () => {
    const { bokioOpDefs } = await import("../src/tools/bokio/index.js");
    for (const def of bokioOpDefs) {
      if (def.method === "get") expect(def.readOnly, def.name).toBe(true);
      else expect(def.readOnly, def.name).toBe(false);
      if (def.method === "delete") expect(def.destructive, def.name).toBe(true);
    }
  });
});
