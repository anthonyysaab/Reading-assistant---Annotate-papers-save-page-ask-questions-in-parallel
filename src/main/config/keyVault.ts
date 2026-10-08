import { app, safeStorage } from "electron";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const PROVIDER_ID_RE = /^[a-zA-Z0-9._-]+$/;

function secretsDir(): string {
  return join(app.getPath("userData"), "secrets");
}

function secretPath(providerId: string): string {
  if (!PROVIDER_ID_RE.test(providerId)) {
    throw new Error(`Invalid provider id: ${providerId}`);
  }
  return join(secretsDir(), `${providerId}.bin`);
}

export async function setSecret(providerId: string, secret: string): Promise<void> {
  if (!secret) throw new Error("Secret must not be empty");
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("OS-backed encryption is unavailable; refusing to store secret in plaintext");
  }
  await mkdir(secretsDir(), { recursive: true });
  await writeFile(secretPath(providerId), safeStorage.encryptString(secret));
}

export async function clearSecret(providerId: string): Promise<void> {
  await rm(secretPath(providerId), { force: true });
}

export async function listConfiguredSecrets(): Promise<Record<string, boolean>> {
  try {
    const files = await readdir(secretsDir());
    const result: Record<string, boolean> = {};
    for (const file of files) {
      if (file.endsWith(".bin")) result[file.slice(0, -4)] = true;
    }
    return result;
  } catch {
    return {};
  }
}

export async function getSecret(providerId: string): Promise<string | null> {
  const path = secretPath(providerId);
  if (!existsSync(path) || !safeStorage.isEncryptionAvailable()) return null;
  return safeStorage.decryptString(await readFile(path));
}
