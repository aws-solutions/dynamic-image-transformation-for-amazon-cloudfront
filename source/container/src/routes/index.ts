// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Router } from 'express';
import healthRoutes from './health';
import imageRoutes from './image';

const router = Router();

// Health check route
router.use('/health', healthRoutes);

// Catch-all route for all image requests
router.use('/', imageRoutes);

export default router;
