import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { Annotation } from "@shared/types";
import { SidecarAnnotationStore } from "./annotations";

interface SidecarShape {
  version: number;
  docPath: string;
  fileHash: string;
  items: Annotation[];
}

interface FallbackMarker {
  storageFallback?: boolean;
}

const dirs: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "ra-anno-"));
  dirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function highlightInput(docPath: string): Parameters<SidecarAnnotationStore["add"]>[0] {
  return {
    docPath,
    kind: "highlight",
    anchor: { page: 3, rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.04 }] },
    quotedText: "the quick brown fox",
    color: "#ffe066"
  };
}

async function readSidecar(docPath: string): Promise<SidecarShape> {
  return JSON.parse(await readFile(`${docPath}.annotations.json`, "utf8")) as SidecarShape;
}

describe("SidecarAnnotationStore", () => {
  it("writes a versioned sidecar next to the document", async () => {
    const dir = await tempDir();
    const docPath = join(dir, "doc.pdf");
    await writeFile(docPath, "PDF-BYTES");
    const store = new SidecarAnnotationStore(join(dir, "fallback"));

    const added = await store.add(highlightInput(docPath));
    const sidecar = await readSidecar(docPath);

    expect(sidecar.version).toBe(1);
    expect(sidecar.docPath).toBe(docPath);
    expect(sidecar.fileHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(sidecar.items).toHaveLength(1);
    expect(sidecar.items[0]?.id).toBe(added.id);
    expect(sidecar.items[0]?.note).toBeUndefined();
    expect(sidecar.items[0]?.stale).toBeUndefined();
  });

  it("round-trips through a fresh store instance", async () => {
    const dir = await tempDir();
    const docPath = join(dir, "doc.pdf");
    await writeFile(docPath, "PDF-BYTES");
    await new SidecarAnnotationStore(join(dir, "fallback")).add(highlightInput(docPath));

    const items = await new SidecarAnnotationStore(join(dir, "fallback")).list(docPath);

    expect(items).toHaveLength(1);
    expect(items[0]?.quotedText).toBe("the quick brown fox");
    expect(items[0]?.anchor.page).toBe(3);
    expect(items[0]?.stale).toBeUndefined();
  });

  it("never mutates the original document", async () => {
    const dir = await tempDir();
    const docPath = join(dir, "doc.pdf");
    await writeFile(docPath, "PDF-BYTES");
    const before = await readFile(docPath);

    await new SidecarAnnotationStore(join(dir, "fallback")).add(highlightInput(docPath));

    expect((await readFile(docPath)).equals(before)).toBe(true);
  });

  it("treats a malformed sidecar as empty", async () => {
    const dir = await tempDir();
    const docPath = join(dir, "doc.pdf");
    await writeFile(docPath, "PDF-BYTES");
    await writeFile(`${docPath}.annotations.json`, "{ not valid json");

    const items = await new SidecarAnnotationStore(join(dir, "fallback")).list(docPath);

    expect(items).toEqual([]);
  });

  it("flags items stale (but keeps them) when the document hash changes", async () => {
    const dir = await tempDir();
    const docPath = join(dir, "doc.pdf");
    await writeFile(docPath, "ORIGINAL-CONTENT");
    const store = new SidecarAnnotationStore(join(dir, "fallback"));
    await store.add(highlightInput(docPath));

    await writeFile(docPath, "CHANGED");
    const items = await new SidecarAnnotationStore(join(dir, "fallback")).list(docPath);

    expect(items).toHaveLength(1);
    expect(items[0]?.stale).toBe(true);
  });

  it("updates and removes items", async () => {
    const dir = await tempDir();
    const docPath = join(dir, "doc.pdf");
    await writeFile(docPath, "PDF-BYTES");
    const store = new SidecarAnnotationStore(join(dir, "fallback"));
    const added = await store.add(highlightInput(docPath));

    const updated = await store.update(added.id, { note: "check this", color: "#74c0fc" });
    expect(updated.note).toBe("check this");
    expect(updated.color).toBe("#74c0fc");
    expect((await readSidecar(docPath)).items[0]?.note).toBe("check this");

    await store.remove(added.id);
    expect((await readSidecar(docPath)).items).toEqual([]);
  });

  it("falls back to the fallback directory when the sidecar path is unwritable", async () => {
    const dir = await tempDir();
    const docPath = join(dir, "readonly.pdf");
    await writeFile(docPath, "PDF-BYTES");
    await mkdir(`${docPath}.annotations.json`);
    const fallbackDir = join(dir, "fallback");

    const store = new SidecarAnnotationStore(fallbackDir);
    const added = await store.add(highlightInput(docPath));
    expect((added as Annotation & FallbackMarker).storageFallback).toBe(true);

    const items = await new SidecarAnnotationStore(fallbackDir).list(docPath);
    expect(items).toHaveLength(1);
    expect((items[0] as Annotation & FallbackMarker).storageFallback).toBe(true);
  });
});
