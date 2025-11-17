// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Request } from 'express';
import { PathMapping } from '../../cache/domain/path-mapping-cache';
import { HeaderMapping } from '../../cache/domain/header-mapping-cache';
import { ImageProcessingRequest } from '../../../types/image-processing-request';

export interface MappingResolutionResult {
  pathMatch?: PathMapping;
  hostMatch?: HeaderMapping;
  selectedMapping: PathMapping | HeaderMapping;
  resolvedBy: 'path' | 'host';
}

export interface IMappingResolver {
  resolve(req: Request, imageRequest: ImageProcessingRequest): Promise<MappingResolutionResult>;
}