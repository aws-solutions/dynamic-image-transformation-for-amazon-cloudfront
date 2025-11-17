// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { OutputOption } from "../types/interfaces";

export const availableOutputs: OutputOption[] = [
  {
    id: 'quality',
    title: 'Quality Optimization',
    description: 'Adaptive quality based on device pixel ratio',
    category: 'optimization'
  },
  {
    id: 'format',
    title: 'Format Optimization',
    description: 'Automatic format selection based on browser support',
    category: 'optimization'
  },
  {
    id: 'autosize',
    title: 'Auto Sizing',
    description: 'Automatic width derivatives for responsive images',
    category: 'optimization'
  }
];