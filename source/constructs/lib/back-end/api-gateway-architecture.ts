// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from "path";
import { LambdaRestApiProps, RestApi } from "aws-cdk-lib/aws-apigateway";
import {
  AllowedMethods,
  CachePolicy,
  DistributionProps,
  IOrigin,
  OriginRequestPolicy,
  OriginSslPolicy,
  PriceClass,
  ViewerProtocolPolicy,
  Function,
  FunctionCode,
  FunctionEventType,
  CfnDistribution,
  Distribution,
  FunctionRuntime,
  IDistribution,
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { CfnLogGroup } from "aws-cdk-lib/aws-logs";
import { Aspects, Aws, CfnCondition, Duration, Fn, Lazy } from "aws-cdk-lib";
import { CloudFrontToApiGatewayToLambda } from "@aws-solutions-constructs/aws-cloudfront-apigateway-lambda";

import { addCfnSuppressRules } from "../../utils/utils";
import * as api from "aws-cdk-lib/aws-apigateway";
import { ConditionAspect } from "../../utils/aspects";
import { readFileSync } from "fs";
import { BackEnd, BackEndProps } from "./back-end-construct";

export interface ApiGatewayArchitectureProps extends BackEndProps {
  originRequestPolicy: OriginRequestPolicy;
  cachePolicy: CachePolicy;
  imageHandlerLambdaFunction: NodejsFunction;
  existingDistribution: IDistribution;
}

export class ApiGatewayArchitecture {
  public readonly imageHandlerCloudFrontDistribution: Distribution;
  constructor(scope: BackEnd, props: ApiGatewayArchitectureProps) {
    const apiGatewayRestApi = RestApi.fromRestApiId(
      scope,
      "ApiGatewayRestApi",
      Lazy.string({
        produce: () => imageHandlerCloudFrontApiGatewayLambda.apiGateway.restApiId,
      })
    );

    const origin: IOrigin = new HttpOrigin(`${apiGatewayRestApi.restApiId}.execute-api.${Aws.REGION}.amazonaws.com`, {
      originPath: "/image",
      originSslProtocols: [OriginSslPolicy.TLS_V1_1, OriginSslPolicy.TLS_V1_2],
    });

    // Slice off the last line since CloudFront functions can't have module exports but we need to export the handler to unit test it.
    const inlineCloudFrontFunction: string[] = readFileSync(
      path.join(__dirname, "../../../image-handler/cloudfront-function-handlers/apig-request-modifier.js"),
      "utf-8"
    )
      .split("\n")
      .slice(0, -1);

    const requestModifierFunction = new Function(scope, "ApigRequestModifierFunction", {
      functionName: `sih-apig-request-modifier-${props.uuid}`,
      code: FunctionCode.fromInline(inlineCloudFrontFunction.join("\n")),
      runtime: FunctionRuntime.JS_2_0,
    });
    Aspects.of(requestModifierFunction).add(new ConditionAspect(props.conditions.disableS3ObjectLambdaCondition));

    const cloudFrontDistributionProps: DistributionProps = {
      comment: "Image Handler Distribution for Dynamic Image Transformation for Amazon CloudFront",
      defaultBehavior: {
        origin,
        allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        originRequestPolicy: props.originRequestPolicy,
        cachePolicy: props.cachePolicy,
        functionAssociations: [
          {
            function: requestModifierFunction,
            eventType: FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      priceClass: props.cloudFrontPriceClass as PriceClass,
      enableLogging: true,
      logBucket: props.logsBucket,
      logFilePrefix: "api-cloudfront/",
      errorResponses: [
        { httpStatus: 500, ttl: Duration.minutes(10) },
        { httpStatus: 501, ttl: Duration.minutes(10) },
        { httpStatus: 502, ttl: Duration.minutes(10) },
        { httpStatus: 503, ttl: Duration.minutes(10) },
        { httpStatus: 504, ttl: Duration.minutes(10) },
      ],
    };

    const apiGatewayProps: LambdaRestApiProps = {
      handler: props.imageHandlerLambdaFunction,
      deployOptions: {
        stageName: "image",
      },
      binaryMediaTypes: ["*/*"],
      defaultMethodOptions: {
        authorizationType: api.AuthorizationType.NONE,
      },
    };

    const imageHandlerCloudFrontApiGatewayLambda = new CloudFrontToApiGatewayToLambda(
      scope,
      "ImageHandlerCloudFrontApiGatewayLambda",
      {
        existingLambdaObj: props.imageHandlerLambdaFunction,
        insertHttpSecurityHeaders: false,
        cloudFrontDistributionProps,
        apiGatewayProps,
      }
    );
    this.imageHandlerCloudFrontDistribution = imageHandlerCloudFrontApiGatewayLambda.cloudFrontWebDistribution;
    Aspects.of(imageHandlerCloudFrontApiGatewayLambda).add(
      new ConditionAspect(props.conditions.disableS3ObjectLambdaCondition)
    );

    imageHandlerCloudFrontApiGatewayLambda.apiGateway.node.tryRemoveChild("Endpoint"); // we don't need the RestApi endpoint in the outputs

    const cfnDistribution = imageHandlerCloudFrontApiGatewayLambda.cloudFrontWebDistribution.node
      .defaultChild as CfnDistribution;
    cfnDistribution.addOverride("Properties.DistributionConfig.Origins.0.OriginShield", {
      "Fn::If": [
        props.conditions.enableOriginShieldCondition.logicalId,
        { Enabled: true, OriginShieldRegion: props.originShieldRegion },
        { Enabled: false },
      ],
    });
    Aspects.of(cfnDistribution).add(
      new ConditionAspect(
        new CfnCondition(scope, "DeployAPIGDistribution", {
          expression: Fn.conditionAnd(
            props.conditions.disableS3ObjectLambdaCondition,
            Fn.conditionNot(props.conditions.useExistingCloudFrontDistributionCondition)
          ),
        })
      )
    );

    // Access the underlying CfnLogGroup to add conditions
    const cfnLogGroup = imageHandlerCloudFrontApiGatewayLambda.apiGatewayLogGroup.node.defaultChild as CfnLogGroup;

    cfnLogGroup.addOverride(
      "Properties.RetentionInDays",
      Fn.conditionIf(props.conditions.isLogRetentionPeriodInfinite.logicalId, Aws.NO_VALUE, props.logRetentionPeriod)
    );

    addCfnSuppressRules(imageHandlerCloudFrontApiGatewayLambda.apiGateway, [
      {
        id: "W59",
        reason:
          "AWS::ApiGateway::Method AuthorizationType is set to 'NONE' because API Gateway behind CloudFront does not support AWS_IAM authentication",
      },
    ]);
    addCfnSuppressRules(imageHandlerCloudFrontApiGatewayLambda.apiGateway.deploymentStage, [
      {
        id: "W87",
        reason: "Cache not enabled, using CloudFront for caching viewer response",
      },
    ]);
    addCfnSuppressRules(imageHandlerCloudFrontApiGatewayLambda.apiGatewayCloudWatchRole, [
      {
        id: "F10",
        reason: "Inline policy used in solutions construct",
      },
    ]);
    imageHandlerCloudFrontApiGatewayLambda.apiGateway.methods.forEach((method) => {
      addCfnSuppressRules(method, [
        {
          id: "W59",
          reason: "No authorization currently on the API Gateway",
        },
      ]);
    });

    imageHandlerCloudFrontApiGatewayLambda.apiGateway.node.tryRemoveChild("Endpoint"); // we don't need the RestApi endpoint in the outputs
    scope.domainName = Fn.conditionIf(
      props.conditions.useExistingCloudFrontDistributionCondition.logicalId,
      props.existingDistribution.distributionDomainName,
      imageHandlerCloudFrontApiGatewayLambda.cloudFrontWebDistribution.distributionDomainName
    ).toString();
  }
}
