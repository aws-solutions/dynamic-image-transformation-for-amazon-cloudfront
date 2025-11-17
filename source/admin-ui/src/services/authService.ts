// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getCurrentUser, signOut } from 'aws-amplify/auth';

export class AuthService {
  static async getCurrentUser() {
    try {
      const cognitoUser = await getCurrentUser();
      return {
        id: cognitoUser.userId,
        name: cognitoUser.username,
        email: cognitoUser.username,
        role: 'user'
      };
    } catch (error) {
      return null;
    }
  }

  static async signOut() {
    try {
      await signOut({ global: true });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }
}
