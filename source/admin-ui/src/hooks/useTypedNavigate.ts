// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useNavigate, generatePath } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

export const useTypedNavigate = () => {
  const navigate = useNavigate();

  return {
    toOriginMappingDetails: (id: string) => navigate(generatePath(ROUTES.ORIGIN_MAPPING_DETAILS, { id })),
    toOriginMappingEdit: (id: string) => navigate(generatePath(ROUTES.ORIGIN_MAPPING_EDIT, { id })),
    toOrigins: () => navigate(ROUTES.ORIGINS),
    toOriginCreate: () => navigate(ROUTES.ORIGIN_CREATE),
    toOriginDetails: (id: string) => navigate(generatePath(ROUTES.ORIGIN_DETAILS, { id })),
    toOriginEdit: (id: string) => navigate(generatePath(ROUTES.ORIGIN_EDIT, { id })),
    toMappings: () => navigate(ROUTES.MAPPINGS),
    toMappingCreate: () => navigate(ROUTES.MAPPING_CREATE),
    toMappingDetails: (id: string) => navigate(generatePath(ROUTES.MAPPING_DETAILS, { id })),
    toMappingEdit: (id: string) => navigate(generatePath(ROUTES.MAPPING_EDIT, { id })),
    toPolicies: () => navigate(ROUTES.TRANSFORMATION_POLICIES),
    toPolicyCreate: () => navigate(ROUTES.TRANSFORMATION_POLICY_CREATE),
    toPolicyDetails: (id: string) => navigate(generatePath(ROUTES.TRANSFORMATION_POLICY_DETAILS, { id })),
    toPolicyEdit: (id: string) => navigate(generatePath(ROUTES.TRANSFORMATION_POLICY_EDIT, { id }))
  };
};