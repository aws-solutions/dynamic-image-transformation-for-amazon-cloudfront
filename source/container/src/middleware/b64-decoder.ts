// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RequestHandler } from "express";

/**
 * Middleware that decodes base64url-encoded JSON payloads from the URL path.
 * Rewrites req.url with the decoded path and populates req.query from edits/policyId.
 * Falls through silently for non-B64 paths.
 * @returns Express RequestHandler
 */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function b64DecoderMiddleware(): RequestHandler {
  return (req, res, next) => {
    delete req.headers["x-dit-b64"];

    const raw = req.url.split("?")[0].replace(/^\//, "");
    if (!raw) return next();

    let parsed: unknown;
    try {
      parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    } catch {
      return next();
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return res.status(400).json({ error: "B64 payload must be a JSON object" });
    }

    const payload = parsed as Record<string, unknown>;

    if (!("path" in payload)) {
      return res.status(400).json({ error: 'B64 payload must contain a "path" field' });
    }

    if (typeof payload.path !== "string") {
      return res.status(400).json({ error: 'B64 "path" field must be a string' });
    }

    if (!payload.path.startsWith("/")) {
      return res.status(400).json({ error: 'B64 "path" must start with "/"' });
    }

    if (/(?:^|[\\/])\.\.(?:[\\/]|$)/.test(payload.path)) {
      return res.status(400).json({ error: 'B64 "path" must not contain path traversal' });
    }

    if (/[?#]/.test(payload.path)) {
      return res.status(400).json({ error: 'B64 "path" must not contain "?" or "#"' });
    }

    req.url = payload.path;
    req.query = {};
    req.headers["x-dit-b64"] = "true";

    if (typeof payload.policyId === "string") {
      req.query.policyId = payload.policyId;
    }

    if (typeof payload.edits === "object" && payload.edits !== null && !Array.isArray(payload.edits)) {
      for (const [key, value] of Object.entries(payload.edits as Record<string, unknown>)) {
        if (DANGEROUS_KEYS.has(key)) continue;
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
            if (DANGEROUS_KEYS.has(subKey)) continue;
            req.query[`${key}.${subKey}`] = subValue as string;
          }
        } else {
          req.query[key] = value as string;
        }
      }
    }

    next();
  };
}
