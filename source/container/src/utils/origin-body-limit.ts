// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import os from "os";
import { ImageProcessingError } from "../services/image-processing/types";
import { urlWithoutQuery } from "./url-without-query";

// Half of task memory: every image under the pixel limit fits well below it, and an oversized
// origin body fails its own request instead of exhausting memory for the whole task.
const MEMORY_FRACTION = 0.5;

export interface OriginBodyLimit {
  memoryBytes: number;
  limitBytes: number;
  source: "task" | "cgroup" | "totalmem";
}

export function resolveOriginBodyLimit(
  constrainedMemory: (() => number | undefined) | undefined = process.constrainedMemory?.bind(process),
  totalMemory: () => number = os.totalmem,
  taskMemoryMib: string | undefined = process.env.DIT_TASK_MEMORY_MIB
): OriginBodyLimit {
  // Fargate sets memory at the task level, which the container's cgroup does not show and os.totalmem() overstates,
  // so CDK passes the task size; the cgroup and total memory are fallbacks for local runs.
  const mib = taskMemoryMib !== undefined && /^\d+$/.test(taskMemoryMib) ? Number(taskMemoryMib) : 0;
  const taskBytes = mib * 1024 * 1024;
  if (mib > 0 && Number.isSafeInteger(taskBytes)) {
    const memoryBytes = taskBytes;
    return { memoryBytes, limitBytes: Math.floor(memoryBytes * MEMORY_FRACTION), source: "task" };
  }
  const total = totalMemory();
  const cgroup = constrainedMemory?.();
  const useCgroup = typeof cgroup === "number" && Number.isFinite(cgroup) && cgroup > 0 && cgroup <= total;
  const memoryBytes = useCgroup ? cgroup : total;
  return {
    memoryBytes,
    limitBytes: Math.floor(memoryBytes * MEMORY_FRACTION),
    source: useCgroup ? "cgroup" : "totalmem",
  };
}

const resolved = resolveOriginBodyLimit();
console.log(JSON.stringify({ component: "OriginBodyLimit", operation: "origin_body_limit", ...resolved }));

export const ORIGIN_BODY_LIMIT_BYTES = resolved.limitBytes;

function tooLarge(url: string, limit: number, size: string): ImageProcessingError {
  return new ImageProcessingError(
    502,
    "OriginImageTooLarge",
    "Origin image exceeds the maximum size",
    `Origin '${urlWithoutQuery(url)}' body of ${size} bytes exceeds the ${limit} byte limit.`
  );
}

/**
 * The declared length only allows an early rejection; the streamed byte count is what the limit is enforced on.
 * Returns the usable declared length so the reader can fill one buffer instead of copying chunks at the end.
 */
export function assertDeclaredLength(
  declared: number | string | null | undefined,
  limit: number,
  url: string
): number | undefined {
  let length: number | undefined;
  if (typeof declared === "number") {
    length = Number.isInteger(declared) && declared >= 0 ? declared : undefined;
  } else if (typeof declared === "string" && /^\d+$/.test(declared)) {
    length = Number(declared);
  }
  if (length !== undefined && length > limit) {
    throw tooLarge(url, limit, String(length));
  }
  return length;
}

// Collects chunks under the limit. With a declared length the bytes go straight into one buffer, so a body
// near the limit is held once; concatenating separate chunks would briefly hold it twice.
class LimitedCollector {
  private readonly chunks: Uint8Array[] = [];
  private target?: Buffer;
  private total = 0;

  constructor(
    private readonly limit: number,
    private readonly url: string,
    declaredLength?: number
  ) {
    if (declaredLength !== undefined) this.target = Buffer.allocUnsafe(declaredLength);
  }

  add(chunk: Uint8Array): void {
    const next = this.total + chunk.byteLength;
    if (next > this.limit) throw tooLarge(this.url, this.limit, `more than ${this.limit}`);
    if (this.target && next <= this.target.length) {
      this.target.set(chunk, this.total);
    } else {
      this.spill();
      this.chunks.push(chunk);
    }
    this.total = next;
  }

  result(): Buffer {
    if (this.chunks.length === 0 && this.target) return this.target.subarray(0, this.total);
    return Buffer.concat(this.chunks, this.total);
  }

  // A body longer than its declared length falls back to chunks, keeping what was already copied.
  private spill(): void {
    if (this.target && this.chunks.length === 0 && this.total > 0) {
      this.chunks.push(Buffer.from(this.target.subarray(0, this.total)));
    }
    this.target = undefined;
  }
}

/** Enforces the limit while streaming, because Content-Length can be absent or understated. */
export async function readWebStreamWithLimit(
  body: ReadableStream<Uint8Array> | null,
  limit: number,
  url: string,
  declaredLength?: number
): Promise<Buffer> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const collector = new LimitedCollector(limit, url, declaredLength);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      collector.add(value);
    }
  } catch (error) {
    // The reader holds the stream's lock, so only it can release the socket; the caller's cancel() cannot.
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return collector.result();
}

/** Enforces the limit while streaming, because S3 ContentLength can be absent or understated. */
export async function readNodeStreamWithLimit(
  body: AsyncIterable<Uint8Array> & { destroy?: () => void },
  limit: number,
  url: string,
  declaredLength?: number
): Promise<Buffer> {
  const collector = new LimitedCollector(limit, url, declaredLength);
  for await (const chunk of body) {
    try {
      collector.add(chunk);
    } catch (error) {
      body.destroy?.();
      throw error;
    }
  }
  return collector.result();
}
