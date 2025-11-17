// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CognitoIdentityProviderClient, AdminCreateUserCommand, AdminSetUserPasswordCommand, AdminDeleteUserCommand, UpdateUserPoolCommand, DescribeUserPoolCommand, SetUserPoolMfaConfigCommand } from '@aws-sdk/client-cognito-identity-provider';
import * as fs from 'fs';
import * as path from 'path';

let originalMfaConfig: any = null;

export default (config: any) => ({
  'setup:testUser': async ({ userPoolId }: { userPoolId: string }) => {
    const client = new CognitoIdentityProviderClient({
      region: config.env.AWS_REGION
    });

    // Read credentials from fixture
    const usersFixture = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../fixtures/seeds/users.json'), 'utf8')
    );
    const { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD_FALLBACK } = usersFixture.testUser;
    
    const TEST_USER_PASSWORD = config.env.USER_PASSWORD || TEST_USER_PASSWORD_FALLBACK;

    try {
      // 1. Get current User Pool MFA configuration
      const userPoolResponse = await client.send(new DescribeUserPoolCommand({
        UserPoolId: userPoolId
      }));
      
      originalMfaConfig = userPoolResponse.UserPool?.MfaConfiguration;
      console.log(`Original MFA config: ${originalMfaConfig}`);

      // 2. Only disable MFA if it's currently enabled
      if (originalMfaConfig !== 'OFF') {
        await client.send(new UpdateUserPoolCommand({
          UserPoolId: userPoolId,
          MfaConfiguration: 'OFF'
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
        console.log(`Test user ${TEST_USER_EMAIL} already exists, skipping creation`);
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

      // 2. Enable MFA with authenticator apps after tests
      try {
        await client.send(new SetUserPoolMfaConfigCommand({
          UserPoolId: userPoolId,
          MfaConfiguration: 'ON',
          SoftwareTokenMfaConfiguration: {
            Enabled: true
          }
        }));
        console.log('MFA enabled with authenticator apps after tests');
      } catch (mfaError: any) {
        console.error('Failed to enable MFA:', mfaError.message);
        // Don't throw - just log the error so cleanup continues
      }

      return true;
    } catch (error: any) {
      if (error.name === 'UserNotFoundException') {
        console.log(`Test user ${TEST_USER_EMAIL} not found, skipping deletion`);
        
        // Enable MFA with authenticator apps even if user deletion fails
        try {
          await client.send(new SetUserPoolMfaConfigCommand({
            UserPoolId: userPoolId,
            MfaConfiguration: 'ON',
            SoftwareTokenMfaConfiguration: {
              Enabled: true
            }
          }));
          console.log('MFA enabled with authenticator apps after tests');
        } catch (mfaError: any) {
          console.error('Failed to enable MFA:', mfaError.message);
        }
        
        return true;
      }
      throw error;
    }
  }
});