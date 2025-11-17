// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Mock AuthService for local development
export class MockAuthService {
  private static mockUser = {
    id: 'mock-user-123',
    name: 'John Developer',
    email: 'john.developer@example.com',
    role: 'admin'
  };

  private static isAuthenticated = true;

  static async getCurrentUser() {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return this.isAuthenticated ? this.mockUser : null;
  }

  static async signOut() {
    this.isAuthenticated = false;
    // In real app, this would clear tokens
  }

  // Helper for testing different states
  static setAuthState(authenticated: boolean) {
    this.isAuthenticated = authenticated;
  }
}