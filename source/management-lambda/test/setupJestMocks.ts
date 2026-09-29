// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import "./mocks";

// Set required environment variables for all tests
process.env.CONFIG_TABLE_NAME = "test-table";
process.env.ACCOUNT_ID = "123456789012";
process.env.PAGINATION_TOKEN_SECRET_ARN = "arn:aws:secretsmanager:us-east-1:123456789012:secret:test";
