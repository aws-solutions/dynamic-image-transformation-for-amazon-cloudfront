// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TEST_USER } from '../fixtures';
import { AuthService } from '../../services/authService';

// Mock AWS Amplify Auth v6 API
vi.mock('aws-amplify/auth', () => ({
  getCurrentUser: vi.fn(),
  signOut: vi.fn()
}));

// Import the mocked functions after mocking
import { getCurrentUser, signOut } from 'aws-amplify/auth';
const mockGetCurrentUser = getCurrentUser as any;
const mockSignOut = signOut as any;

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('should return user data when authenticated', async () => {
      const mockCognitoUser = {
        userId: 'testuser123',
        username: 'TEST_USER.email'
      };

      mockGetCurrentUser.mockResolvedValueOnce(mockCognitoUser);

      const result = await AuthService.getCurrentUser();

      expect(result).toEqual({
        id: 'testuser123',
        name: 'TEST_USER.email',
        email: 'TEST_USER.email',
        role: 'user'
      });
    });

    it('should return null when not authenticated', async () => {
      mockGetCurrentUser.mockRejectedValueOnce(new Error('Not authenticated'));

      const result = await AuthService.getCurrentUser();

      expect(result).toBeNull();
    });

    it('should return null on any error', async () => {
      mockGetCurrentUser.mockRejectedValueOnce(new Error('Network error'));

      const result = await AuthService.getCurrentUser();

      expect(result).toBeNull();
    });
  });

  describe('signOut', () => {
    it('should call signOut with global option', async () => {
      mockSignOut.mockResolvedValueOnce(undefined);

      await AuthService.signOut();

      expect(mockSignOut).toHaveBeenCalledWith({ global: true });
    });

    it('should handle signOut errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSignOut.mockRejectedValueOnce(new Error('Sign out failed'));

      // Should not throw, just log error
      await AuthService.signOut();

      expect(consoleSpy).toHaveBeenCalledWith('Sign out error:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
