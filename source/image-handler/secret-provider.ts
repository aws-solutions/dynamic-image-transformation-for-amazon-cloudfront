// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

/**
 * Class provides cached access to the Secret Manager.
 */
export class SecretProvider {
  private readonly cache: { secretId: string; secret: string } = {
    secretId: null,
    secret: null,
  };

  constructor(private readonly secretsManager: SecretsManagerClient) {}

  /**
   * Returns the secret associated with the secret ID.
   * Cached for the life of the execution environment with no TTL; only a changed `secretId` refetches, so a rotated
   * secret VALUE is not seen until the Lambda execution environment is recycled.
   * @param secretId The secret ID.
   * @returns Secret associated with the secret ID.
   */
  async getSecret(secretId: string): Promise<string> {
    if (this.cache.secretId === secretId && this.cache.secret) {
      return this.cache.secret;
    } else {
      const response = await this.secretsManager.send(new GetSecretValueCommand({ SecretId: secretId }));
      this.cache.secretId = secretId;
      this.cache.secret = response.SecretString;

      return this.cache.secret;
    }
  }
}
