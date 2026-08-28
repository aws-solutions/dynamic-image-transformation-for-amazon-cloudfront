// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RemovalPolicy } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";
import { addCfnGuardSuppressRules } from "../../../../utils/utils";

/**
 * Single DynamoDB table storing Origins, Path/Host Mappings, and Transformation Policies
 * with a simple primary key (PK) and three GSIs for efficient access patterns.
 */
export class SingleTableConstruct extends Construct {
  public readonly table: dynamodb.TableV2;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new dynamodb.TableV2(this, "Table", {
      partitionKey: {
        name: "PK",
        type: dynamodb.AttributeType.STRING,
      },
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: this.node.tryGetContext("environment") === "dev" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      // NEW_IMAGE (not NEW_AND_OLD_IMAGES): origin records carry upstream authentication headers, and
      // emitting the old image would expose the outgoing credential alongside the incoming one during
      // a key rotation. Stream consumers only need the post-change state.
      dynamoStream: dynamodb.StreamViewType.NEW_IMAGE,
      encryption: dynamodb.TableEncryptionV2.awsManagedKey(),
    });

    this.table.addGlobalSecondaryIndex({
      indexName: "GSI1",
      partitionKey: {
        name: "GSI1PK",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "GSI1SK",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: "GSI2",
      partitionKey: {
        name: "GSI2PK",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: "GSI3",
      partitionKey: {
        name: "GSI3PK",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });
    addCfnGuardSuppressRules(this.table, [
      {
        id: "DYNAMODB_TABLE_ENCRYPTED_KMS",
        reason:
          "A customer-managed KMS key is not required. This solution is deployed into the customer's own account, so the table, the key, and the data are all already owned by the customer and there is no AWS-managed trust boundary for a CMK to protect across. Encryption at rest is satisfied by the AWS managed key (aws/dynamodb), which is a deliberate step above the TableV2 default of an AWS owned key. Note that a CMK would not restrict access to individual attributes: DynamoDB encryption is table-level and transparent, so any principal permitted to read the table receives plaintext regardless of which key is used.",
      },
    ]);
  }
}
