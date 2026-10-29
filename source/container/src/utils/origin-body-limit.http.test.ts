// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import http from "http";
import { AddressInfo } from "net";
import { ConnectionManager } from "../services/request-resolver/connection-manager/connection-manager";
import { OriginFetcher } from "../services/image-processing/origin-fetcher";
import { ImageProcessingRequest } from "../types/image-processing-request";

const LIMIT = 64 * 1024;
const CHUNK = 16 * 1024;
const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const TOO_LARGE = { statusCode: 502, errorType: "OriginImageTooLarge" };

type Mode = "declared-over" | "chunked-over" | "endless" | "under";

function jpegOfLength(length: number): Buffer {
  const buf = Buffer.alloc(length, 1);
  JPEG_HEAD.copy(buf);
  return buf;
}

const UNDER_BODY = jpegOfLength(LIMIT - 1);

describe("origin body limit against a real HTTP origin", () => {
  let server: http.Server;
  let baseUrl: string;
  // Reset per request so each case checks that its own oversized response stopped the server's writes.
  let closedEarly: Promise<boolean>;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const mode = req.url!.slice(1) as Mode;
      let resolveClosed!: (early: boolean) => void;
      closedEarly = new Promise((resolve) => {
        resolveClosed = resolve;
      });
      res.on("close", () => resolveClosed(!res.writableFinished));

      if (mode === "under") {
        res.writeHead(200, { "content-type": "image/jpeg", "content-length": UNDER_BODY.length });
        res.end(UNDER_BODY);
        return;
      }
      // Far larger than loopback socket buffers, so the write can only finish if the client keeps reading.
      const total = mode === "endless" ? Infinity : LIMIT * 1024;
      const headers: http.OutgoingHttpHeaders = { "content-type": "image/jpeg" };
      if (mode === "declared-over") headers["content-length"] = total;
      res.writeHead(200, headers);
      let sent = 0;
      const write = () => {
        while (!res.destroyed && sent < total) {
          const chunk = sent === 0 ? jpegOfLength(CHUNK) : Buffer.alloc(CHUNK, 1);
          sent += CHUNK;
          if (!res.write(chunk)) {
            res.once("drain", write);
            return;
          }
        }
        if (!res.destroyed) res.end();
      };
      write();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  const callers: Array<[string, (url: string) => Promise<Buffer>]> = [
    [
      "ConnectionManager",
      async (url) => {
        const request = { requestId: "http-limit" } as ImageProcessingRequest;
        await new ConnectionManager(undefined, LIMIT).fetchOriginImage(url, request);
        return request.sourceImage!.buffer;
      },
    ],
    ["OriginFetcher", async (url) => (await new OriginFetcher(LIMIT).fetchImage(url)).buffer],
  ];

  describe.each(callers)("%s", (_name, fetchBody) => {
    it.each<Mode>(["declared-over", "chunked-over", "endless"])(
      "rejects the %s body with 502 and closes the socket early",
      async (mode) => {
        await expect(fetchBody(`${baseUrl}/${mode}`)).rejects.toMatchObject(TOO_LARGE);
        expect(await closedEarly).toBe(true);
      }
    );

    it("returns a body under the limit with identical bytes", async () => {
      const buffer = await fetchBody(`${baseUrl}/under`);
      expect(buffer.equals(UNDER_BODY)).toBe(true);
    });
  });
});
