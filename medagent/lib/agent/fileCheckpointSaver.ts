import fs from "fs";
import path from "path";

import { MemorySaver } from "@langchain/langgraph-checkpoint";
import type {
  ChannelVersions,
  Checkpoint,
  CheckpointMetadata,
  PendingWrite,
} from "@langchain/langgraph-checkpoint";
import type { RunnableConfig } from "@langchain/core/runnables";

type PersistedStorage = Record<
  string,
  Record<string, Record<string, [string, string, string | undefined]>>
>;
type PersistedWrites = Record<string, Record<string, [string, string, string]>>;

type PersistedCheckpointFile = {
  storage: PersistedStorage;
  writes: PersistedWrites;
};

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function encodeBytes(value: Uint8Array) {
  return Buffer.from(value).toString("base64");
}

function decodeBytes(value: string) {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function toPersistedStorage(storage: MemorySaver["storage"]): PersistedStorage {
  const next: PersistedStorage = {};

  for (const [threadId, namespaces] of Object.entries(storage)) {
    next[threadId] = {};
    for (const [namespace, checkpoints] of Object.entries(namespaces)) {
      next[threadId][namespace] = {};
      for (const [checkpointId, tuple] of Object.entries(checkpoints)) {
        next[threadId][namespace][checkpointId] = [
          encodeBytes(tuple[0]),
          encodeBytes(tuple[1]),
          tuple[2],
        ];
      }
    }
  }

  return next;
}

function toPersistedWrites(writes: MemorySaver["writes"]): PersistedWrites {
  const next: PersistedWrites = {};

  for (const [outerKey, values] of Object.entries(writes)) {
    next[outerKey] = {};
    for (const [innerKey, tuple] of Object.entries(values)) {
      next[outerKey][innerKey] = [tuple[0], tuple[1], encodeBytes(tuple[2])];
    }
  }

  return next;
}

function fromPersistedStorage(
  storage: PersistedStorage,
): MemorySaver["storage"] {
  const next: MemorySaver["storage"] = {};

  for (const [threadId, namespaces] of Object.entries(storage)) {
    next[threadId] = {};
    for (const [namespace, checkpoints] of Object.entries(namespaces)) {
      next[threadId][namespace] = {};
      for (const [checkpointId, tuple] of Object.entries(checkpoints)) {
        next[threadId][namespace][checkpointId] = [
          decodeBytes(tuple[0]),
          decodeBytes(tuple[1]),
          tuple[2],
        ];
      }
    }
  }

  return next;
}

function fromPersistedWrites(writes: PersistedWrites): MemorySaver["writes"] {
  const next: MemorySaver["writes"] = {};

  for (const [outerKey, values] of Object.entries(writes)) {
    next[outerKey] = {};
    for (const [innerKey, tuple] of Object.entries(values)) {
      next[outerKey][innerKey] = [tuple[0], tuple[1], decodeBytes(tuple[2])];
    }
  }

  return next;
}

export class FileCheckpointSaver extends MemorySaver {
  constructor(private readonly filePath: string) {
    super();
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return;
      }

      const parsed = JSON.parse(
        fs.readFileSync(this.filePath, "utf8"),
      ) as PersistedCheckpointFile;

      if (!parsed || typeof parsed !== "object") {
        return;
      }

      this.storage = fromPersistedStorage(parsed.storage ?? {});
      this.writes = fromPersistedWrites(parsed.writes ?? {});
    } catch {
      this.storage = {};
      this.writes = {};
    }
  }

  private async persistToDisk() {
    ensureParentDir(this.filePath);
    const payload: PersistedCheckpointFile = {
      storage: toPersistedStorage(this.storage),
      writes: toPersistedWrites(this.writes),
    };

    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.${Math.random()
      .toString(16)
      .slice(2)}.tmp`;

    try {
      await fs.promises.writeFile(tempPath, JSON.stringify(payload));
      await fs.promises.rename(tempPath, this.filePath);
    } catch (error) {
      try {
        if (fs.existsSync(tempPath)) {
          await fs.promises.unlink(tempPath);
        }
      } catch {
        // best-effort temp cleanup
      }
      console.error("FileCheckpointSaver persist failed", error);
      throw error;
    }
  }

  async put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata,
    _newVersions?: ChannelVersions,
  ): Promise<RunnableConfig> {
    const nextConfig = await super.put(config, checkpoint, metadata);
    await this.persistToDisk();
    return nextConfig;
  }

  async putWrites(
    config: RunnableConfig,
    writes: PendingWrite[],
    taskId: string,
  ): Promise<void> {
    await super.putWrites(config, writes, taskId);
    await this.persistToDisk();
  }

  async deleteThread(threadId: string): Promise<void> {
    await super.deleteThread(threadId);
    await this.persistToDisk();
  }
}
