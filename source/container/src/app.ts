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
app.use('/', routes);

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

export default app;
