// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CfnOutput } from "aws-cdk-lib";
import {
  AccessLogField,
  AccessLogFormat,
  AuthorizationType,
  CognitoUserPoolsAuthorizer,
  GatewayResponse,
  LambdaRestApi,
  LogGroupLogDestination,
  ResponseType,
} from "aws-cdk-lib/aws-apigateway";
import { UserPool } from "aws-cdk-lib/aws-cognito";
import { TableV2 } from "aws-cdk-lib/aws-dynamodb";
import { Function as LambdaFunction } from "aws-cdk-lib/aws-lambda";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import path from "path";
import { addCfnGuardSuppressRules } from "../../../../utils/utils";
import { DITNodejsFunction } from "../common";
import { SingleTableConstruct } from "./single-table-construct";

interface DalConstructProps {
  userPool: UserPool;
}

export class DalConstruct extends Construct {
  readonly lambda: LambdaFunction;
  readonly api: LambdaRestApi;
  readonly table: TableV2;

  constructor(scope: Construct, id: string, props: DalConstructProps) {
    super(scope, id);

    this.table = new SingleTableConstruct(this, "ConfigTable").table;

    this.lambda = new DITNodejsFunction(this, "ApiLambda", {
      entry: path.join(__dirname, "../../../../../management-lambda/index.ts"),
      environment: {
        CONFIG_TABLE_NAME: this.table.tableName,
        POWERTOOLS_LOGGER_LOG_LEVEL: "INFO",
        POWERTOOLS_LOGGER_LOG_EVENT: "false",
      },
    });
    this.table.grantReadWriteData(this.lambda);

    addCfnGuardSuppressRules(this.lambda, [
      {
        id: "LAMBDA_INSIDE_VPC",
        reason:
          "Management API Lambda does not require VPC access as it only interacts with DynamoDB and API Gateway, which are accessible via AWS service endpoints.",
      },
      {
        id: "LAMBDA_CONCURRENCY_CHECK",
        reason:
          "Management API Lambda uses default account-level concurrency limits. Reserved concurrency is not configured as this function does not have specific concurrency isolation requirements.",
      },
    ]);

    const prodLogGroup = new LogGroup(this, "ProdLogs", {
      retention: RetentionDays.TEN_YEARS,
    });

    // Add CFN Guard suppression for CloudWatch Log Group encryption requirement
    addCfnGuardSuppressRules(prodLogGroup, [
      {
        id: "CLOUDWATCH_LOG_GROUP_ENCRYPTED",
        reason:
          "CFN Guard KMS key requirement suppressed as there's no customer information involved. Using AWS managed encryption is sufficient for API Gateway access logs.",
      },
    ]);

    const authorizerFullAccess = new CognitoUserPoolsAuthorizer(this, "FullAccessAuthorizer", {
      authorizerName: "FullAccessAuthorizer",
      identitySource: "method.request.header.Authorization",
      cognitoUserPools: [props.userPool],
    });

    this.api = new LambdaRestApi(this, "DITApi", {
      handler: this.lambda,
      proxy: true, // all supported methods have same lambda integration
      deployOptions: {
        stageName: "prod",
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
        accessLogDestination: new LogGroupLogDestination(prodLogGroup),
        accessLogFormat: AccessLogFormat.custom(
          JSON.stringify({
            requestId: AccessLogField.contextRequestId(),
            extendedRequestId: AccessLogField.contextExtendedRequestId(),
            sourceIp: AccessLogField.contextIdentitySourceIp(),
            caller: AccessLogField.contextIdentityCaller(),
            user: AccessLogField.contextIdentityUser(),
            method: AccessLogField.contextHttpMethod(),
            resourcePath: AccessLogField.contextResourcePath(),
            protocol: AccessLogField.contextProtocol(),
            status: AccessLogField.contextStatus(),
            requestTime: AccessLogField.contextRequestTime(),
            responseLength: AccessLogField.contextResponseLength(),
          })
        ),
        tracingEnabled: true,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: ["*"],
        allowMethods: ["*"],
        allowCredentials: false,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
          "X-Amz-User-Agent",
        ],
      },
      defaultMethodOptions: {
        authorizer: authorizerFullAccess,
        authorizationType: AuthorizationType.COGNITO,
        authorizationScopes: ["dit-api/api"], // scope to restrict user pool authenticated user access on API Gateway
      },
    });

    addCfnGuardSuppressRules(this.api.deploymentStage, [
      {
        id: "API_GW_CACHE_ENABLED_AND_ENCRYPTED",
        reason: "API Gateway caching is not required for this management API as it handles low-frequency administrative operations with dynamic responses."
      }
    ]);

    const responseHeaders = {
      "gatewayresponse.header.Access-Control-Allow-Origin": "'*'",
      "gatewayresponse.header.Access-Control-Allow-Headers":
        "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
      "gatewayresponse.header.Access-Control-Allow-Methods": "'GET,OPTIONS,POST,PUT,DELETE'",
    };

    // Add CORS headers to responses generated by Api Gateway itself. For responses by lambda functions, headers have to be set in the respective function.
    new GatewayResponse(this, `CORSResponse4xx`, {
      restApi: this.api,
      type: ResponseType.DEFAULT_4XX,
      responseHeaders,
    });
    new GatewayResponse(this, `CORSResponse5xx`, {
      restApi: this.api,
      type: ResponseType.DEFAULT_5XX,
      responseHeaders,
    });

    new CfnOutput(this, "ConfigTableName", {
      value: this.table.tableName,
      description: "DynamoDB table for storing all DIT configurations",
    });
  }
}
