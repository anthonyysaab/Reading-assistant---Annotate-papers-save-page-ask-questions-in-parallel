import { app, shell } from "electron";
import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { UpdateInfo } from "@shared/types";
import { asArray, asRecord, asString } from "@main/providers/json";

const GITHUB_REPO =
  "anthonyysaab/Reading-assistant---Annotate-papers-save-page-ask-questions-in-parallel";
const RELEASES_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${GITHUB_REPO}/releases`;
const USER_AGENT = "Reading-Assistant";

function parseVersion(value: string): number[] {
  return value
    .replace(/^v/i, "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((part) => Number.parseInt(part, 10) || 0);
}

/** Compare two version strings; >0 when `a` is newer than `b`, 0 when equal. */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l !== r) return l > r ? 1 : -1;
  }
  return 0;
}

function noUpdate(current: string): UpdateInfo {
  return { current, latest: null, available: false, releaseUrl: RELEASES_PAGE, installerUrl: null };
}

/** Query the GitHub Releases API for the latest build and compare it to the running version. */
export async function checkForUpdate(): Promise<UpdateInfo> {
  const current = app.getVersion();
  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return noUpdate(current);

    const payload = asRecord((await response.json()) as unknown);
    const latest = (asString(payload?.["tag_name"]) ?? "").replace(/^v/i, "");
    if (!latest) return noUpdate(current);

    const releaseUrl = asString(payload?.["html_url"]) ?? RELEASES_PAGE;
    let installerUrl: string | null = null;
    for (const asset of asArray(payload?.["assets"])) {
      const record = asRecord(asset);
      const name = asString(record?.["name"]);
      const url = asString(record?.["browser_download_url"]);
      if (name && url && /setup\.exe$/i.test(name)) {
        installerUrl = url;
        break;
      }
    }

    return {
      current,
      latest,
      available: compareVersions(latest, current) > 0,
      releaseUrl,
      installerUrl
    };
  } catch {
    return noUpdate(current);
  }
}

/** Download the latest installer asset to a temp file and launch it (the user finishes the update). */
export async function downloadAndInstallUpdate(): Promise<void> {
  const info = await checkForUpdate();
  if (!info.available || !info.installerUrl) {
    throw new Error("No update is available to install.");
  }
  const response = await fetch(info.installerUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(120000)
  });
  if (!response.ok) {
    throw new Error(`Update download failed (${response.status}).`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const name = basename(new URL(info.installerUrl).pathname) || "ReadingAssistant-setup.exe";
  const target = join(app.getPath("temp"), name);
  await writeFile(target, buffer);
  const error = await shell.openPath(target);
  if (error) throw new Error(`Could not launch the installer: ${error}`);
}
