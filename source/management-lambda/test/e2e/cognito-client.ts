// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CognitoIdentityProviderClient,
  CreateUserPoolClientCommand,
  CreateUserPoolClientCommandInput,
  DeleteUserPoolClientCommand,
} from "@aws-sdk/client-cognito-identity-provider";

/**
 * Attaches a new AppClient with clientId and secret to the user pool.
 * Returns  the base64 encoded client id and secret to be used for basic auth.
 */
export class CognitoClient {
  private readonly client: CognitoIdentityProviderClient;

  constructor(private region: string) {
    this.client = new CognitoIdentityProviderClient({ region });
  }

  async createCognitoAppClient({ userPoolId }: { userPoolId: string }) {
    const input: CreateUserPoolClientCommandInput = {
      UserPoolId: userPoolId,
      ClientName: "E2ETestClient",
      GenerateSecret: true,
      AllowedOAuthFlows: ["client_credentials"],
      AllowedOAuthScopes: ["dit-api/api"],
      AllowedOAuthFlowsUserPoolClient: true,
    };
    const command = new CreateUserPoolClientCommand(input);
    const response = await this.client.send(command);
    const clientId = response.UserPoolClient?.ClientId;
    const clientSecret = response.UserPoolClient?.ClientSecret;

    if (!clientId || !clientSecret) throw new Error("Failed to create cognito client");

    const credentials = `${clientId}:${clientSecret}`;
    const base64Credentials = Buffer.from(credentials).toString("base64");
    return { clientId, base64Credentials };
  }

  async deleteCognitoAppClient({ userPoolId, clientId }: { userPoolId: string; clientId: string }) {
    if (clientId) {
      const input = {
        UserPoolId: userPoolId,
        ClientId: clientId,
      };
      const command = new DeleteUserPoolClientCommand(input);
      try {
        await this.client.send(command);
      } catch (error) {
        console.error("Failed to delete cognito client", error);
      }
    }
  }

  async fetchAccessToken({
    base64Credentials,
    cognitoDomainPrefix,
  }: {
    base64Credentials: string;
    cognitoDomainPrefix: string;
  }) {
    const headers = {
      Authorization: `Basic ${base64Credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      scope: "dit-api/api",
    });

    const cognitoTokenEndpointUrl = `https://${cognitoDomainPrefix}.auth.${this.region}.amazoncognito.com/oauth2/token`;

    const tokenResponse = await fetch(cognitoTokenEndpointUrl, {
      method: "POST",
      headers: headers,
      body: body,
    });

    // @ts-ignore
    const tokenResponseBody: { access_token: string } = await tokenResponse.json();
    return tokenResponseBody.access_token;
  }
}
