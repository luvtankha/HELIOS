import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";

export interface DocumentStorage {
  store(key: string, content: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export class LocalPrivateDocumentStorage implements DocumentStorage {
  private readonly root: string;

  constructor(root = env.STORAGE_PATH) {
    this.root = resolve(root);
  }

  async store(key: string, content: Buffer) {
    const path = this.safePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, { flag: "wx", mode: 0o600 });
  }

  async read(key: string) {
    const path = this.safePath(key);
    try {
      return await readFile(path);
    } catch {
      throw new AppError(
        "Document content is unavailable",
        404,
        "DOCUMENT_FILE_NOT_FOUND",
      );
    }
  }

  async remove(key: string) {
    const path = this.safePath(key);
    await unlink(path).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
    });
  }

  private safePath(key: string) {
    if (!key || key.includes("\0") || key.includes(".."))
      throw new AppError(
        "Invalid document storage key",
        400,
        "DOCUMENT_STORAGE_KEY_INVALID",
      );
    const path = resolve(this.root, key.replaceAll("\\", "/"));
    if (path !== this.root && !path.startsWith(`${this.root}${sep}`))
      throw new AppError(
        "Invalid document storage key",
        400,
        "DOCUMENT_STORAGE_KEY_INVALID",
      );
    return path;
  }
}

export function storageKey(
  patientId: string,
  documentId: string,
  fileName: string,
) {
  const extension = extname(fileName)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "");
  return `${patientId}/${documentId}/original${extension || ".bin"}`;
}
