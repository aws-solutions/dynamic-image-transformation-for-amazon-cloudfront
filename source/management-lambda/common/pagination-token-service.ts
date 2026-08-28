// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { logger } from "./logger";
import { getOptions } from "../../solution-utils/get-options";

const secretsClient = new SecretsManagerClient(getOptions());

/**
 * Token payload structure for encrypted pagination tokens
 * Contains all necessary information for secure, versioned pagination
 */
export interface TokenPayload {
  /** Token format version */
  version: number;

  /** Expiration timestamp (Unix epoch in milliseconds) */
  expiresAt: number;

  /** AWS account ID for account binding */
  accountId: string;

  /** DynamoDB LastEvaluatedKey for single cursor queries (BaseDAO) */
  cursor?: Record<string, any>;

  /** Multiple DynamoDB cursors for composite queries (MappingDAO) */
  compositeCursors?: {
    [entityType: string]: Record<string, any>;
  };
}

/**
 * Error codes for token validation failures
 */
export enum TokenValidationErrorCode {
  EXPIRED = "TOKEN_EXPIRED",
  TAMPERED = "TOKEN_TAMPERED",
  ACCOUNT_MISMATCH = "ACCOUNT_MISMATCH",
  UNSUPPORTED_VERSION = "UNSUPPORTED_VERSION",
  MALFORMED = "TOKEN_MALFORMED",
  DECRYPTION_FAILED = "DECRYPTION_FAILED",
}

/**
 * Result of token validation and decryption
 */
export interface TokenValidationResult {
  /** Whether the token is valid */
  valid: boolean;

  /** Token payload if valid */
  payload?: TokenPayload;

  /** Error message if invalid */
  error?: string;

  /** Error code for programmatic handling */
  errorCode?: TokenValidationErrorCode;
}

/**
 * Options for generating a pagination token
 */
export interface TokenGenerationOptions {
  /** AWS account ID for account binding */
  accountId: string;

  /** Single DynamoDB cursor for simple queries (e.g., BaseDAO) */
  cursor?: Record<string, any>;

  /** Multiple DynamoDB cursors for composite queries (e.g., MappingDAO) */
  compositeCursors?: {
    [entityType: string]: Record<string, any>;
  };

  /** Custom expiration time in milliseconds (defaults to 24 hours) */
  expirationMs?: number;
}

/**
 * Service for generating and validating secure pagination tokens
 * Implements AWS API standards for pagination token security
 */
export class PaginationTokenService {
  private readonly currentVersion = 1;
  private readonly defaultExpirationMs = 24 * 60 * 60 * 1000; // 24 hours
  private readonly salt = Buffer.from("pagination-token-salt-v1");
  // Static property to cache encryption key across invocations
  private static cachedKey: Buffer | undefined;

  /**
   * Generate an encrypted pagination token
   *
   * @param options - Token generation options including account ID and cursor data
   * @returns Encrypted, Base64-encoded pagination token
   * @throws Error if neither cursor nor compositeCursors provided, or if cursors are empty
   */
  async generateToken(options: TokenGenerationOptions): Promise<string> {
    this.validateCursors(options);

    const expirationMs = options.expirationMs ?? this.defaultExpirationMs;
    const payload: TokenPayload = {
      version: this.currentVersion,
      expiresAt: Date.now() + expirationMs,
      accountId: options.accountId,
      ...(options.cursor && { cursor: options.cursor }),
      ...(options.compositeCursors && { compositeCursors: options.compositeCursors }),
    };

    const { encrypted, iv, authTag } = await this.encryptPayload(payload);

    // Combine encrypted data, IV, and auth tag, then Base64url encode
    // Format: [iv_length(1 byte)][iv][auth_tag(16 bytes)][encrypted_data]
    const ivLength = Buffer.from([iv.length]);
    const combined = Buffer.concat([ivLength, iv, authTag, encrypted]);

    return combined.toString("base64url");
  }

  /**
   * Validate and decrypt a pagination token
   *
   * @param token - Encrypted pagination token from client
   * @param accountId - AWS account ID to validate against
   * @returns Validation result with payload if valid, or error details
   */
  async validateToken(token: string, accountId: string): Promise<TokenValidationResult> {
    try {
      const combined = Buffer.from(token, "base64url");

      // Parse token format: [iv_length(1 byte)][iv][auth_tag(16 bytes)][encrypted_data]
      if (combined.length < 18) {
        // Minimum: 1 byte iv_length + 1 byte iv + 16 bytes auth_tag
        return {
          valid: false,
          error: "Token is malformed: insufficient length",
          errorCode: TokenValidationErrorCode.MALFORMED,
        };
      }

      const ivLength = combined[0];
      if (combined.length < 1 + ivLength + 16) {
        return {
          valid: false,
          error: "Token is malformed: invalid structure",
          errorCode: TokenValidationErrorCode.MALFORMED,
        };
      }

      const iv = combined.subarray(1, 1 + ivLength);
      const authTag = combined.subarray(1 + ivLength, 1 + ivLength + 16);
      const encryptedData = combined.subarray(1 + ivLength + 16);

      const payload = await this.decryptPayload(encryptedData, iv, authTag);

      // Token validation checks for version, expiry and account binding:
      if (payload.version !== this.currentVersion) {
        return {
          valid: false,
          error: `Unsupported token version: ${payload.version}`,
          errorCode: TokenValidationErrorCode.UNSUPPORTED_VERSION,
        };
      }

      if (payload.expiresAt < Date.now()) {
        return {
          valid: false,
          error: "Token has expired",
          errorCode: TokenValidationErrorCode.EXPIRED,
        };
      }

      if (payload.accountId !== accountId) {
        return {
          valid: false,
          error: "Token account ID does not match",
          errorCode: TokenValidationErrorCode.ACCOUNT_MISMATCH,
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      if (error instanceof Error) logger.error(`Token decryption failed: ${error.message}`);
      return {
        valid: false,
        error: "Unknown error during token validation",
        errorCode: TokenValidationErrorCode.DECRYPTION_FAILED,
      };
    }
  }

  /**
   * Validate cursor options
   *
   * @param options - Token generation options
   * @throws Error if no cursors provided, both provided, or cursors are empty
   */
  private validateCursors(options: TokenGenerationOptions): void {
    const hasCursor = !!options.cursor;
    const hasCompositeCursors = !!options.compositeCursors;

    // Must provide exactly one of cursor or compositeCursors
    if (!hasCursor && !hasCompositeCursors) {
      throw new Error("Either cursor or compositeCursors must be provided");
    }

    if (hasCursor && hasCompositeCursors) {
      throw new Error("Cannot provide both cursor and compositeCursors");
    }

    // Validate composite cursors not empty
    if (hasCompositeCursors && Object.keys(options.compositeCursors!).length === 0) {
      throw new Error("Composite cursors cannot be empty");
    }
  }

  /**
   * Extract DynamoDB cursor or cursors from validated token payload
   *
   * @param payload - Validated token payload
   * @returns Single cursor or composite cursors object
   */
  extractCursors(payload: TokenPayload): Record<string, any> | Record<string, Record<string, any>> {
    if (payload.cursor) {
      return payload.cursor;
    }
    if (payload.compositeCursors) {
      return payload.compositeCursors;
    }
    throw new Error("No cursors found in token payload");
  }

  /**
   * Encrypt token payload using AES-256-GCM
   *
   * @param payload - Token payload to encrypt
   * @returns Encrypted data with IV and auth tag
   */
  private async encryptPayload(payload: TokenPayload): Promise<{ encrypted: Buffer; iv: Buffer; authTag: Buffer }> {
    const key = await this.getEncryptionKey();
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    const payloadString = JSON.stringify(payload);
    const encrypted = Buffer.concat([cipher.update(payloadString, "utf8"), cipher.final()]);

    // Authentication tag (for tamper detection)
    const authTag = cipher.getAuthTag();

    return { encrypted, iv, authTag };
  }

  /**
   * Decrypt token payload using AES-256-GCM
   *
   * @param encryptedData - Encrypted token data
   * @param iv - Initialization vector
   * @param authTag - Authentication tag
   * @returns Decrypted token payload
   */
  private async decryptPayload(encryptedData: Buffer, iv: Buffer, authTag: Buffer): Promise<TokenPayload> {
    const key = await this.getEncryptionKey();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encryptedData), decipher.final()]);
    const payloadString = decrypted.toString("utf8");

    return JSON.parse(payloadString) as TokenPayload;
  }

  /**
   * Get or derive encryption key from environment (using secret from Secrets Manager)
   * @returns Encryption key for AES-256-GCM
   */
  private async getEncryptionKey(): Promise<Buffer> {
    if (PaginationTokenService.cachedKey) {
      logger.debug("Using cached encryption key");
      return PaginationTokenService.cachedKey;
    }

    if (!process.env.PAGINATION_TOKEN_SECRET_ARN) {
      throw new Error("PAGINATION_TOKEN_SECRET_ARN environment variable is not set");
    }

    const secretResponse = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: process.env.PAGINATION_TOKEN_SECRET_ARN })
    );
    const passphrase = secretResponse.SecretString;
    if (!passphrase) {
      throw new Error("Secret string is empty");
    }

    // Derive 256-bit key using scrypt with static salt
    const key = scryptSync(
      passphrase,
      this.salt,
      32 // 32 bytes = 256 bits for AES-256
    );
    logger.debug("Derived encryption key from secret");

    // Cache for performance
    PaginationTokenService.cachedKey = key;
    return key;
  }
}
