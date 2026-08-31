// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import routes from './routes';
import { initializeContainer } from './services/initialization';
import { queryTypesMiddleware } from './middleware/query-types';
import { b64DecoderMiddleware } from './middleware/b64-decoder';
import { cognitoJwtValidator } from './middleware/cognito-jwt-validator';

// Create Express application
const app = express();

// Security middleware
app.use(helmet());

// CORS middleware
app.use(cors());

// Compression middleware
app.use(compression());

// QS + Query-types custom middleware
app.use(queryTypesMiddleware())

// B64-encoded path decoder middleware
app.use(b64DecoderMiddleware());

// Logging middleware
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize container services
initializeContainer().catch(error => {
  console.error('Failed to initialize container:', error);
});

// Use routes from routes directory
app.use('/', cognitoJwtValidator, routes);

// Client-error responses for the 4xx statuses Express itself raises before a route runs.
const CLIENT_ERRORS: Record<number, { error: string; message: string }> = {
  400: { error: 'BAD_REQUEST', message: 'Malformed request' },
  413: { error: 'PAYLOAD_TOO_LARGE', message: 'Request entity too large' }
};
const DEFAULT_CLIENT_ERROR = { error: 'CLIENT_ERROR', message: 'Request rejected' };

/**
 * Returns the HTTP status of a client-input error, or undefined if the error is not the
 * caller's fault. Express and body-parser attach a status to errors raised before a route
 * runs: 400 for malformed percent-encoding in the path (a URIError from decodeURIComponent,
 * which cannot be caught at the route level), 400 for an unparseable JSON body, 413 for an
 * oversized payload. Any of these surfacing as a 500 would misreport a client error as ours.
 */
export function getClientErrorStatus(err: Error): number | undefined {
  const { status, statusCode } = err as Error & { status?: unknown; statusCode?: unknown };
  const candidate = typeof status === 'number' ? status : statusCode;

  if (typeof candidate === 'number' && candidate >= 400 && candidate < 500) {
    return candidate;
  }

  // A URIError always means undecodable caller input, even if no status was attached.
  return err instanceof URIError ? 400 : undefined;
}

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const clientErrorStatus = getClientErrorStatus(err);
  if (clientErrorStatus !== undefined) {
    console.warn('Client error:', clientErrorStatus, err.message);

    const { error, message } = CLIENT_ERRORS[clientErrorStatus] ?? DEFAULT_CLIENT_ERROR;
    return res.status(clientErrorStatus).json({
      error,
      message: process.env.NODE_ENV === 'development' ? err.message : message,
      timestamp: new Date().toISOString()
    });
  }

  console.error('Unhandled error:', err);

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

export default app;
