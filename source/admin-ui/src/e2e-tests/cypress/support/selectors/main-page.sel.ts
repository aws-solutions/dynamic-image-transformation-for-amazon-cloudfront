// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const MainPageSelectors = {
  USER_DROPDOWN: 'button[class*="awsui_test-utils-button-trigger"][aria-haspopup="true"]',
  SIGN_OUT_MENU: 'span[role="menuitem"]:contains("Sign out")',
  CREATE_ORIGIN_BUTTON: 'Create origin'
} as const;
