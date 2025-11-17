// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Alert } from '@cloudscape-design/components';

export const PropagationDisclaimer: React.FC = () => {
  return (
    <Alert type="info" header="Configuration Delay and Cached Images Notice">
      Changes to origins, transformation policies, or mappings may take up to 5 minutes to propagate across all image processing tasks. 
      During this period, some requests may still use the previous configuration. Configuration updates do not automatically refresh 
      cached images. Cached images processed with previous settings will remain available until they expire or are manually invalidated.
    </Alert>
  );
};
