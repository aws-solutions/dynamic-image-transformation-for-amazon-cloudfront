// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import cognitoTasks from './tasks/cognito';

module.exports = (on: any, config: any) => {
  on('task', {
    ...cognitoTasks(config),
  });
  
  return config;
};
