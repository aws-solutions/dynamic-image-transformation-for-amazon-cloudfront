// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request, Response, NextFunction } from 'express';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { applyDeviceSimulation } from './device-simulation';

const { COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID } = process.env;

const verifier = COGNITO_USER_POOL_ID
  ? CognitoJwtVerifier.create({
      userPoolId: COGNITO_USER_POOL_ID,
      tokenUse: 'access',
      clientId: COGNITO_CLIENT_ID!,
    })
  : null;

// Soft auth: never rejects; a valid token only unlocks metrics (served no-store) and device simulation. Uses
// x-dit-authorization because Authorization is forwarded to origins (routes/image.ts).
// With COGNITO_USER_POOL_ID unset every request is unauthenticated.
export async function cognitoJwtValidator(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.locals.isAuthenticated = false;

  if (!verifier) return next();

  try {
    const authHeader = req.headers['x-dit-authorization'] as string | undefined;
    if (!authHeader?.startsWith('Bearer ')) return next();

    await verifier.verify(authHeader.slice(7));
    res.locals.isAuthenticated = true;
    applyDeviceSimulation(req);
    console.log(JSON.stringify({
      component: 'CognitoAuth',
      operation: 'token_validated',
      deviceSimulation: req.headers['x-dit-sim-viewport'] ? true : undefined,
    }));
  } catch (error) {
    console.log(JSON.stringify({ component: 'CognitoAuth', operation: 'token_rejected', reason: error instanceof Error ? error.message : 'unknown' }));
  }

  next();
}
