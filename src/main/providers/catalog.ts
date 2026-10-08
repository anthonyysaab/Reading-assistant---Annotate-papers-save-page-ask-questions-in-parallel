import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { asRecord, parseJson } from "./json";
import { parseCatalogModels, type Catalog } from "./catalogParse";

export { catalogModelsFor, parseCatalogModels, type Catalog } from "./catalogParse";

const CATALOG_URL = "https://models.dev/api.json";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

interface DiskCache {
  fetchedAt: number;
  data: Catalog;
}

let memory: Catalog | null = null;

function cachePath(): string {
  return join(app.getPath("userData"), "catalog", "models.json");
}

async function readDiskCache(): Promise<DiskCache | null> {
  try {
    const parsed = asRecord(parseJson(await readFile(cachePath(), "utf8")));
    if (!parsed) return null;
    const fetchedAt = parsed["fetchedAt"];
    const data = parsed["data"];
    if (typeof fetchedAt !== "number" || !data) return null;
    return { fetchedAt, data: data as Catalog };
  } catch {
    return null;
  }
}

async function writeDiskCache(catalog: Catalog): Promise<void> {
  const cache: DiskCache = { fetchedAt: Date.now(), data: catalog };
  const path = cachePath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cache), "utf8");
}

async function fetchCatalog(): Promise<Catalog | null> {
  try {
    const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return null;
    const catalog = parseCatalogModels((await response.json()) as unknown);
    if (Object.keys(catalog).length === 0) return null;
    return catalog;
  } catch {
    return null;
  }
}

export async function loadCatalog(): Promise<Catalog> {
  if (memory) return memory;

  const disk = await readDiskCache();
  if (disk && Date.now() - disk.fetchedAt < CACHE_TTL_MS) {
    memory = disk.data;
    return memory;
  }

  const fresh = await fetchCatalog();
  if (fresh) {
    memory = fresh;
    await writeDiskCache(fresh).catch(() => undefined);
    return memory;
  }

  memory = disk?.data ?? {};
  return memory;
}
