// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const mockVerify = jest.fn();

process.env.COGNITO_USER_POOL_ID = 'us-east-1_testpool';
process.env.COGNITO_CLIENT_ID = 'test-client-id';

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: () => ({ verify: mockVerify }),
  },
}));

import { cognitoJwtValidator } from './cognito-jwt-validator';

describe('cognitoJwtValidator', () => {
  const createMockReq = (headers: Record<string, string> = {}) => ({ headers }) as any;
  const createMockRes = () => ({ locals: {} }) as any;
  const mockNext = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should skip verification and set isAuthenticated to false when no Bearer token present', async () => {
    const req = createMockReq({ 'x-dit-authorization': 'Basic abc123' });
    const res = createMockRes();

    await cognitoJwtValidator(req, res, mockNext);

    expect(res.locals.isAuthenticated).toBe(false);
    expect(mockVerify).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should set isAuthenticated to true and strip Bearer prefix when token is valid', async () => {
    mockVerify.mockResolvedValueOnce({ sub: 'user-123' });
    const req = createMockReq({ 'x-dit-authorization': 'Bearer my.jwt.token' });
    const res = createMockRes();

    await cognitoJwtValidator(req, res, mockNext);

    expect(mockVerify).toHaveBeenCalledWith('my.jwt.token');
    expect(res.locals.isAuthenticated).toBe(true);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should set isAuthenticated to false when token verification fails', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Token expired'));
    const req = createMockReq({ 'x-dit-authorization': 'Bearer expired-token' });
    const res = createMockRes();

    await cognitoJwtValidator(req, res, mockNext);

    expect(mockVerify).toHaveBeenCalledWith('expired-token');
    expect(res.locals.isAuthenticated).toBe(false);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should never call next with an error argument', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Token expired'));
    const req = createMockReq({ 'x-dit-authorization': 'Bearer bad-token' });
    const res = createMockRes();

    await cognitoJwtValidator(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledWith();
  });
});
