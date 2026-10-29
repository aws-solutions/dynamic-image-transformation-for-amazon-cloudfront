// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Readable } from "stream";
import {
  ORIGIN_BODY_LIMIT_BYTES,
  assertDeclaredLength,
  readNodeStreamWithLimit,
  readWebStreamWithLimit,
  resolveOriginBodyLimit,
} from "./origin-body-limit";
import { ImageProcessingError } from "../services/image-processing/types";

const URL = "https://origin.example.com/a.jpg";
const GIB = 1024 ** 3;

function webStream(chunks: Uint8Array[]): { stream: ReadableStream<Uint8Array>; cancel: jest.Mock } {
  const cancel = jest.fn();
  let i = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]);
      else controller.close();
    },
    cancel,
  });
  return { stream, cancel };
}

async function expectTooLarge(promise: Promise<unknown>): Promise<void> {
  await expect(promise).rejects.toMatchObject({ statusCode: 502, errorType: "OriginImageTooLarge" });
}

describe("resolveOriginBodyLimit", () => {
  // The default task-memory argument reads the environment, so keep it unset unless a test sets it.
  const savedTaskMemory = process.env.DIT_TASK_MEMORY_MIB;
  beforeEach(() => delete process.env.DIT_TASK_MEMORY_MIB);
  afterAll(() => {
    if (savedTaskMemory !== undefined) process.env.DIT_TASK_MEMORY_MIB = savedTaskMemory;
  });

  it("uses the cgroup limit when it is positive and below total memory", () => {
    expect(
      resolveOriginBodyLimit(
        () => 2 * GIB,
        () => 8 * GIB
      )
    ).toEqual({ memoryBytes: 2 * GIB, limitBytes: GIB, source: "cgroup" });
  });

  it("uses the cgroup limit when it equals total memory", () => {
    expect(
      resolveOriginBodyLimit(
        () => 4 * GIB,
        () => 4 * GIB
      )
    ).toEqual({ memoryBytes: 4 * GIB, limitBytes: 2 * GIB, source: "cgroup" });
  });

  it("uses total memory when the cgroup limit is above it", () => {
    expect(
      resolveOriginBodyLimit(
        () => 64 * GIB,
        () => 4 * GIB
      )
    ).toEqual({ memoryBytes: 4 * GIB, limitBytes: 2 * GIB, source: "totalmem" });
  });

  it.each([0, -1, NaN, Infinity, undefined])("uses total memory when the cgroup limit is %p", (value) => {
    expect(
      resolveOriginBodyLimit(
        () => value as number,
        () => 4 * GIB
      )
    ).toEqual({ memoryBytes: 4 * GIB, limitBytes: 2 * GIB, source: "totalmem" });
  });

  it("uses total memory when constrainedMemory is unavailable", () => {
    expect(resolveOriginBodyLimit(undefined, () => 4 * GIB)).toEqual({
      memoryBytes: 4 * GIB,
      limitBytes: 2 * GIB,
      source: "totalmem",
    });
  });

  it("floors an odd memory size", () => {
    expect(
      resolveOriginBodyLimit(
        () => 5,
        () => 8 * GIB
      ).limitBytes
    ).toBe(2);
  });

  it.each([
    ["2048", 2 * GIB],
    ["4096", 4 * GIB],
  ])("uses the task memory of %s MiB over the cgroup and host memory", (mib, memoryBytes) => {
    expect(
      resolveOriginBodyLimit(
        () => GIB,
        () => 16 * GIB,
        mib
      )
    ).toEqual({ memoryBytes, limitBytes: memoryBytes / 2, source: "task" });
  });

  it.each(["0", "abc", "", "-1", "2048.5", "9".repeat(400)])(
    "falls back to the cgroup when the task memory is %p",
    (mib) => {
      expect(
        resolveOriginBodyLimit(
          () => 2 * GIB,
          () => 8 * GIB,
          mib
        )
      ).toEqual({ memoryBytes: 2 * GIB, limitBytes: GIB, source: "cgroup" });
    }
  );

  it("reads the task memory from DIT_TASK_MEMORY_MIB by default", () => {
    process.env.DIT_TASK_MEMORY_MIB = "2048";
    expect(resolveOriginBodyLimit(undefined, () => 16 * GIB)).toEqual({
      memoryBytes: 2 * GIB,
      limitBytes: GIB,
      source: "task",
    });
  });

  it("exports a positive limit for this process", () => {
    expect(ORIGIN_BODY_LIMIT_BYTES).toBeGreaterThan(0);
  });
});

describe("assertDeclaredLength", () => {
  it.each([11, "11"])("rejects a declared length of %p over the limit", (declared) => {
    expect(() => assertDeclaredLength(declared, 10, URL)).toThrow(ImageProcessingError);
    try {
      assertDeclaredLength(declared, 10, URL);
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 502,
        errorType: "OriginImageTooLarge",
        message: "Origin image exceeds the maximum size",
      });
      expect((error as ImageProcessingError).verboseDescription).toContain("11");
      expect((error as ImageProcessingError).verboseDescription).toContain("10");
    }
  });

  it.each([10, "10", 9, "0"])("accepts a declared length of %p at or under the limit", (declared) => {
    expect(() => assertDeclaredLength(declared, 10, URL)).not.toThrow();
  });

  it.each([undefined, null, "", "1.5", "-1", "abc", -1, 1.5, NaN])(
    "ignores an unusable declared length of %p",
    (declared) => {
      expect(() => assertDeclaredLength(declared as any, 10, URL)).not.toThrow();
    }
  );
});

describe("readWebStreamWithLimit", () => {
  it("returns an empty buffer for a missing body", async () => {
    expect(await readWebStreamWithLimit(null, 10, URL)).toEqual(Buffer.alloc(0));
  });

  it("returns the concatenated bytes under the limit", async () => {
    const { stream } = webStream([new Uint8Array([1, 2]), new Uint8Array([3])]);
    expect(await readWebStreamWithLimit(stream, 10, URL)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("accepts a body exactly at the limit", async () => {
    const { stream } = webStream([new Uint8Array(6), new Uint8Array(4)]);
    expect((await readWebStreamWithLimit(stream, 10, URL)).length).toBe(10);
  });

  it("cancels the stream and rejects once the total passes the limit", async () => {
    const { stream, cancel } = webStream([new Uint8Array(6), new Uint8Array(5), new Uint8Array(100)]);
    await expectTooLarge(readWebStreamWithLimit(stream, 10, URL));
    expect(cancel).toHaveBeenCalled();
  });

  it("still rejects with the size error when cancel itself rejects", async () => {
    const reader = {
      read: jest.fn().mockResolvedValue({ done: false, value: new Uint8Array(11) }),
      cancel: jest.fn().mockRejectedValue(new Error("cancel failed")),
      releaseLock: jest.fn(),
    };
    const stream = { getReader: () => reader } as unknown as ReadableStream<Uint8Array>;
    await expectTooLarge(readWebStreamWithLimit(stream, 10, URL));
    expect(reader.cancel).toHaveBeenCalled();
  });

  it("passes through an error raised while reading", async () => {
    const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
    const stream = new ReadableStream<Uint8Array>({ pull: (controller) => controller.error(abort) });
    await expect(readWebStreamWithLimit(stream, 10, URL)).rejects.toBe(abort);
  });

  it("cancels through the reader and releases its lock when a read fails", async () => {
    const failure = new Error("socket hang up");
    const reader = {
      read: jest.fn().mockRejectedValue(failure),
      cancel: jest.fn().mockResolvedValue(undefined),
      releaseLock: jest.fn(),
    };
    const stream = { getReader: () => reader } as unknown as ReadableStream<Uint8Array>;
    await expect(readWebStreamWithLimit(stream, 10, URL)).rejects.toBe(failure);
    expect(reader.cancel).toHaveBeenCalled();
    expect(reader.releaseLock).toHaveBeenCalled();
  });

  it("releases the lock after a successful read", async () => {
    const { stream } = webStream([new Uint8Array([1, 2, 3])]);
    await readWebStreamWithLimit(stream, 10, URL);
    expect(stream.locked).toBe(false);
  });

  it.each([
    ["equal to the body", 5],
    ["larger than the body", 8],
    ["smaller than the body", 3],
  ])("returns the exact bytes when the declared length is %s", async (_label, declared) => {
    const { stream } = webStream([new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])]);
    expect(await readWebStreamWithLimit(stream, 10, URL, declared)).toEqual(Buffer.from([1, 2, 3, 4, 5]));
  });

  it("still enforces the limit when the declared length understates the body", async () => {
    const { stream, cancel } = webStream([new Uint8Array(4), new Uint8Array(4), new Uint8Array(4), new Uint8Array(4)]);
    await expectTooLarge(readWebStreamWithLimit(stream, 10, URL, 4));
    expect(cancel).toHaveBeenCalled();
  });
});

describe("the size error description", () => {
  it("leaves the query string out of the logged URL", () => {
    try {
      assertDeclaredLength(11, 10, "https://origin.example.com/a.jpg?X-Amz-Signature=secret");
      throw new Error("expected a size error");
    } catch (error) {
      const description = (error as ImageProcessingError).verboseDescription;
      expect(description).toContain("https://origin.example.com/a.jpg");
      expect(description).not.toContain("secret");
    }
  });
});

describe("readNodeStreamWithLimit", () => {
  it("returns the concatenated bytes under the limit", async () => {
    const body = Readable.from([Buffer.from([1, 2]), Buffer.from([3])]);
    expect(await readNodeStreamWithLimit(body, 10, URL)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("accepts a body exactly at the limit", async () => {
    const body = Readable.from([Buffer.alloc(6), Buffer.alloc(4)]);
    expect((await readNodeStreamWithLimit(body, 10, URL)).length).toBe(10);
  });

  it("returns the exact bytes into one buffer when the declared length matches", async () => {
    const body = Readable.from([Buffer.from([1, 2]), Buffer.from([3])]);
    expect(await readNodeStreamWithLimit(body, 10, URL, 3)).toEqual(Buffer.from([1, 2, 3]));
  });

  it("rejects an oversized iterable that has no destroy method", async () => {
    const body = {
      async *[Symbol.asyncIterator]() {
        yield new Uint8Array(6);
        yield new Uint8Array(6);
      },
    };
    await expectTooLarge(readNodeStreamWithLimit(body, 10, URL));
  });

  it("destroys the stream and rejects once the total passes the limit", async () => {
    const body = Readable.from([Buffer.alloc(6), Buffer.alloc(5), Buffer.alloc(100)]);
    const destroy = jest.spyOn(body, "destroy");
    await expectTooLarge(readNodeStreamWithLimit(body, 10, URL));
    expect(destroy).toHaveBeenCalled();
  });
});
