// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminDeleteUserCommand, DescribeUserPoolCommand, SetUserPoolMfaConfigCommand } from '@aws-sdk/client-cognito-identity-provider';
import * as fs from 'fs';
import * as path from 'path';

let originalMfaConfig: string | null = null;

/**
 * Restore the User Pool MFA configuration to whatever it was before setup disabled it.
 * Restoring the captured value (rather than a fixed setting) avoids corrupting pools that
 * were originally OFF/OPTIONAL. originalMfaConfig is captured in setup:testUser and persists
 * across the plugin's Node process.
 */
async function restoreMfaConfig(client: CognitoIdentityProviderClient, userPoolId: string) {
  // Nothing to restore, or it was already disabled — leave it disabled.
  if (!originalMfaConfig || originalMfaConfig === 'OFF') {
    console.log(`Leaving MFA disabled (original config was ${originalMfaConfig ?? 'unknown'})`);
    return;
  }

  try {
    await client.send(new SetUserPoolMfaConfigCommand({
      UserPoolId: userPoolId,
      MfaConfiguration: originalMfaConfig as 'ON' | 'OPTIONAL',
      // ON/OPTIONAL require at least one enabled second factor; software token was the
      // pre-existing method for this pool.
      SoftwareTokenMfaConfiguration: { Enabled: true },
    }));
    console.log(`MFA restored to original config: ${originalMfaConfig}`);
  } catch (mfaError: any) {
    console.error('Failed to restore MFA:', mfaError.message);
    // Don't throw - just log the error so cleanup continues
  }
}

export default (config: any) => ({
  'setup:testUser': async ({ userPoolId }: { userPoolId: string }) => {
    const client = new CognitoIdentityProviderClient({
      region: config.env.AWS_REGION
    });

    // Read credentials from fixture
    const usersFixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../fixtures/seeds/users.json'), 'utf8')
    );
    const { email: TEST_USER_EMAIL } = usersFixture.testUser;

    const TEST_USER_PASSWORD = config.env.USER_PASSWORD;
    if (!TEST_USER_PASSWORD) {
      throw new Error('USER_PASSWORD env var is required to provision the E2E test user');
    }

    try {
      // 1. Get current User Pool MFA configuration
      const userPoolResponse = await client.send(new DescribeUserPoolCommand({
        UserPoolId: userPoolId
      }));
      
      originalMfaConfig = userPoolResponse.UserPool?.MfaConfiguration;
      console.log(`Original MFA config: ${originalMfaConfig}`);

      // 2. Only disable MFA if it's currently enabled
      if (originalMfaConfig !== 'OFF') {
        await client.send(new SetUserPoolMfaConfigCommand({
          UserPoolId: userPoolId,
          MfaConfiguration: 'OFF',
        }));
        console.log('MFA disabled for User Pool');
      } else {
        console.log('MFA already disabled, skipping update');
      }

      // 3. Create user with temporary password
      await client.send(new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: TEST_USER_EMAIL,
        TemporaryPassword: TEST_USER_PASSWORD,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          {
            Name: 'email',
            Value: TEST_USER_EMAIL
          },
          {
            Name: 'email_verified',
            Value: 'true'
          }
        ]
      }));

      // 4. Set permanent password
      await client.send(new AdminSetUserPasswordCommand({
        UserPoolId: userPoolId,
        Username: TEST_USER_EMAIL,
        Password: TEST_USER_PASSWORD,
        Permanent: true
      }));

      console.log(`Test user ${TEST_USER_EMAIL} created successfully`);
      return true;
    } catch (error: any) {
      if (error.name === 'UsernameExistsException') {
        console.log(`Test user ${TEST_USER_EMAIL} already exists, ensuring password is set`);
        // Always reset password to ensure it matches expected credentials
        await client.send(new AdminSetUserPasswordCommand({
          UserPoolId: userPoolId,
          Username: TEST_USER_EMAIL,
          Password: TEST_USER_PASSWORD,
          Permanent: true
        }));
        return true;
      }
      throw error;
    }
  },

  'cleanup:testUser': async ({ userPoolId }: { userPoolId: string }) => {
    const client = new CognitoIdentityProviderClient({
      region: config.env.AWS_REGION
    });

    // Read credentials from fixture
    const usersFixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../fixtures/seeds/users.json'), 'utf8')
    );
    const { email: TEST_USER_EMAIL } = usersFixture.testUser;

    try {
      // 1. Delete test user
      await client.send(new AdminDeleteUserCommand({
        UserPoolId: userPoolId,
        Username: TEST_USER_EMAIL
      }));
      console.log(`Test user ${TEST_USER_EMAIL} deleted successfully`);

      // 2. Restore the original MFA configuration
      await restoreMfaConfig(client, userPoolId);

      return true;
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        console.log(`Test user ${TEST_USER_EMAIL} not found, skipping deletion`);

        // Restore the original MFA configuration even if user deletion failed
        await restoreMfaConfig(client, userPoolId);

        return true;
      }
      throw error;
    }
  }
});