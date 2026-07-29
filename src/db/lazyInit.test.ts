import { existsSync, rmSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const dbPath = "working/lazy-init-test/should-not-exist.db";

describe("client module lazy initialization", () => {
  beforeEach(() => {
    rmSync("working/lazy-init-test", { recursive: true, force: true });
    vi.resetModules();
  });

  afterEach(() => {
    rmSync("working/lazy-init-test", { recursive: true, force: true });
    delete process.env.DATABASE_URL;
  });

  test("importing the module and calling createTestDb does not touch DATABASE_URL's file", async () => {
    process.env.DATABASE_URL = dbPath;

    const { createTestDb } = await import("./client");
    createTestDb();

    expect(existsSync(dbPath)).toBe(false);
  });
});
