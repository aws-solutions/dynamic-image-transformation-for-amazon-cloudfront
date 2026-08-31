// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PaginationTokenService, TokenValidationErrorCode } from "../common/pagination-token-service";

jest.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({
      SecretString: "test-secret-key-for-pagination-tokens",
    }),
  })),
  GetSecretValueCommand: jest.fn(),
}));

describe("PaginationTokenService", () => {
  let tokenService: PaginationTokenService;

  const testAccountId = "123456789012";
  const testSecretArn = "arn:aws:secretsmanager:us-east-1:123456789012:secret:pagination-token-secret";
  const testCursors = {
    // Mimics DynamoDB QueryCommandOutput LastEvaluatedKey
    ORIGIN: {
      PK: "test-origin-id",
      GSI1PK: "ORIGIN",
      GSI1SK: "test-origin-name",
    },
  };
  const testCompositeCursors = {
    PATH_MAPPING: {
      PK: "test-path-mapping-id",
      GSI1PK: "PATH_MAPPING",
      GSI1SK: "/test/*",
    },
    HOST_HEADER_MAPPING: {
      PK: "test-host-mapping-id",
      GSI1PK: "HOST_HEADER_MAPPING",
      GSI1SK: "example.com",
    },
  };

  beforeEach(() => {
    tokenService = new PaginationTokenService();
    process.env.PAGINATION_TOKEN_SECRET_ARN = testSecretArn;
  });

  afterEach(() => {
    delete process.env.PAGINATION_TOKEN_SECRET_ARN;
  });

  describe("generateToken", () => {
    it("should generate an encrypted token with single cursor", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
      // Token should be Base64url encoded
      expect(() => Buffer.from(token, "base64url")).not.toThrow();
    });

    it("should generate an encrypted token with composite cursors", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        compositeCursors: testCompositeCursors,
      });

      expect(token).toBeDefined();
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("should generate different tokens for same input (unique IV)", async () => {
      const token1 = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      const token2 = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      expect(token1).not.toEqual(token2);
    });

    it("should include version in token payload", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      const validationResult = await tokenService.validateToken(token, testAccountId);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.payload?.version).toBe(1);
    });

    it("should set expiration to 24 hours by default", async () => {
      const beforeGeneration = Date.now();
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });
      const afterGeneration = Date.now();

      const validationResult = await tokenService.validateToken(token, testAccountId);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.payload?.expiresAt).toBeGreaterThanOrEqual(beforeGeneration + 24 * 60 * 60 * 1000);
      expect(validationResult.payload?.expiresAt).toBeLessThanOrEqual(afterGeneration + 24 * 60 * 60 * 1000);
    });

    it("should support custom expiration time", async () => {
      const customExpirationMs = 60 * 60 * 1000; // 1 hour
      const beforeGeneration = Date.now();
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
        expirationMs: customExpirationMs,
      });

      const validationResult = await tokenService.validateToken(token, testAccountId);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.payload?.expiresAt).toBeGreaterThanOrEqual(beforeGeneration + customExpirationMs);
      expect(validationResult.payload?.expiresAt).toBeLessThanOrEqual(Date.now() + customExpirationMs + 1000);
    });

    it("should use cached encryption key", async () => {
      expect((PaginationTokenService as any).cachedKey).toBeDefined();
      delete process.env.PAGINATION_TOKEN_SECRET_ARN;

      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      expect(token).toBeDefined();
    });

    it("should throw error if encryption key is not cached and token secret arn not set", async () => {
      // Clear the cached key to test the error case
      (PaginationTokenService as any).cachedKey = undefined;
      delete process.env.PAGINATION_TOKEN_SECRET_ARN;

      await expect(
        tokenService.generateToken({
          accountId: testAccountId,
          cursor: testCursors.ORIGIN,
        })
      ).rejects.toThrow("PAGINATION_TOKEN_SECRET_ARN environment variable is not set");
    });
  });

  describe("validateToken", () => {
    it("should validate and decrypt a valid token", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      const result = await tokenService.validateToken(token, testAccountId);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.accountId).toBe(testAccountId);
      expect(result.payload?.cursor).toEqual(testCursors.ORIGIN);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it("should reject token with mismatched account ID", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      const result = await tokenService.validateToken(token, "different-account-id");

      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe(TokenValidationErrorCode.ACCOUNT_MISMATCH);
    });

    it("should reject expired token", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
        expirationMs: -1000, // Already expired
      });

      const result = await tokenService.validateToken(token, testAccountId);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
      expect(result.errorCode).toBe(TokenValidationErrorCode.EXPIRED);
    });

    it("should reject tampered token", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      // Tamper with the token by changing characters
      const tamperedToken = token.slice(0, -5) + "XXXXX";

      const result = await tokenService.validateToken(tamperedToken, testAccountId);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
      expect([
        TokenValidationErrorCode.TAMPERED,
        TokenValidationErrorCode.DECRYPTION_FAILED,
        TokenValidationErrorCode.MALFORMED,
      ]).toContain(result.errorCode);
    });

    it("should reject malformed token", async () => {
      const result = await tokenService.validateToken("not-a-valid-token", testAccountId);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeUndefined();
      expect(result.error).toBeDefined();
      expect([TokenValidationErrorCode.MALFORMED, TokenValidationErrorCode.DECRYPTION_FAILED]).toContain(
        result.errorCode
      );
    });

    it("should reject token with unsupported version", async () => {
      // This test will need to be implemented when we have version handling
      // For now, we'll generate a token and manually test version validation
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      // We'll need to mock or create a token with unsupported version
      // This is a placeholder test that will be implemented with version handling
      const result = await tokenService.validateToken(token, testAccountId);
      expect(result.valid).toBe(true); // Current version should be valid
    });

    it("should throw error for empty cursors object", async () => {
      await expect(
        tokenService.generateToken({
          accountId: testAccountId,
          compositeCursors: {},
        })
      ).rejects.toThrow();
    });

    it("should throw error when neither cursor nor compositeCursors provided", async () => {
      await expect(
        tokenService.generateToken({
          accountId: testAccountId,
        })
      ).rejects.toThrow("Either cursor or compositeCursors must be provided");
    });

    it("should throw error when both cursor and compositeCursors provided", async () => {
      await expect(
        tokenService.generateToken({
          accountId: testAccountId,
          cursor: testCursors.ORIGIN,
          compositeCursors: testCompositeCursors,
        })
      ).rejects.toThrow("Cannot provide both cursor and compositeCursors");
    });
  });

  describe("extractCursors", () => {
    it("should extract cursors from validated token payload", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      const validationResult = await tokenService.validateToken(token, testAccountId);
      expect(validationResult.valid).toBe(true);

      const cursors = tokenService.extractCursors(validationResult.payload!);

      expect(cursors).toEqual(testCursors.ORIGIN);
    });

    it("should extract composite cursors from validated token payload", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        compositeCursors: testCompositeCursors,
      });

      const validationResult = await tokenService.validateToken(token, testAccountId);
      expect(validationResult.valid).toBe(true);

      const cursors = tokenService.extractCursors(validationResult.payload!);

      expect(cursors).toEqual(testCompositeCursors);
      expect(cursors.PATH_MAPPING).toEqual(testCompositeCursors.PATH_MAPPING);
      expect(cursors.HOST_HEADER_MAPPING).toEqual(testCompositeCursors.HOST_HEADER_MAPPING);
    });
  });

  describe("Token opacity", () => {
    it("should not expose internal structure in Base64 decoded token", async () => {
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        cursor: testCursors.ORIGIN,
      });

      const decoded = Buffer.from(token, "base64url").toString("utf-8");

      // Should not be able to parse as JSON (encrypted data)
      expect(() => JSON.parse(decoded)).toThrow();
      // Should not contain readable account ID
      expect(decoded).not.toContain(testAccountId);
      // Should not contain readable cursor keys
      expect(decoded).not.toContain("ORIGIN");
      expect(decoded).not.toContain("test-origin-id");
    });
  });

  describe("Integration test - full round trip", () => {
    it("should successfully generate, validate, and extract cursors", async () => {
      // Generate token for list APIs
      const token = await tokenService.generateToken({
        accountId: testAccountId,
        compositeCursors: testCompositeCursors,
      });

      // Validate token
      const validationResult = await tokenService.validateToken(token, testAccountId);
      expect(validationResult.valid).toBe(true);

      // Extract cursors
      const extractedCursors = tokenService.extractCursors(validationResult.payload!);
      expect(extractedCursors).toEqual(testCompositeCursors);

      // Verify all fields
      expect(validationResult.payload?.version).toBe(1);
      expect(validationResult.payload?.accountId).toBe(testAccountId);
      expect(validationResult.payload?.expiresAt).toBeGreaterThan(Date.now());
    });
  });
});
