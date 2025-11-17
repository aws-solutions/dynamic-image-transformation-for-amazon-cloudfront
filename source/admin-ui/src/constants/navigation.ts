// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ROUTES } from './routes';

export const NAVIGATION_ITEMS = [
  {
    type: 'link' as const,
    text: 'Origins',
    href: ROUTES.ORIGINS
  },
  {
    type: 'link' as const,
    text: 'Transformation Policies',
    href: ROUTES.TRANSFORMATION_POLICIES
  },
  {
    type: 'link' as const,
    text: 'Mappings',
    href: ROUTES.MAPPINGS
  },
  {
    type: 'divider' as const
  },
  {
    type: 'link' as const,
    text: 'Documentation',
    href: 'https://docs.aws.amazon.com/solutions/latest/dynamic-image-transformation-for-amazon-cloudfront/solution-overview.html',
    external: true
  }
];