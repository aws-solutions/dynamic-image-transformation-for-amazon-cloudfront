// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as path from "path";
import { CfnAccessPoint } from "aws-cdk-lib/aws-s3";
import * as s3objectlambda from "aws-cdk-lib/aws-s3objectlambda";
import {
  AllowedMethods,
  CachePolicy,
  DistributionProps,
  IOrigin,
  OriginRequestPolicy,
  PriceClass,
  ViewerProtocolPolicy,
  Function,
  FunctionCode,
  FunctionEventType,
  CfnDistribution,
  FunctionRuntime,
  Distribution,
  CfnOriginAccessControl,
  IDistribution,
} from "aws-cdk-lib/aws-cloudfront";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Aspects, Aws, CfnCondition, Duration, Fn } from "aws-cdk-lib";
import { ConditionAspect } from "../../utils/aspects";
import { readFileSync } from "fs";
import { BackEnd, BackEndProps } from "./back-end-construct";
import { Effect, Policy, PolicyStatement, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { S3ObjectLambdaOrigin } from "./s3-object-lambda-origin";
import { addCfnSuppressRules } from "../../utils/utils";

export interface S3ObjectLambdaArchitectureProps extends BackEndProps {
  originRequestPolicy: OriginRequestPolicy;
  cachePolicy: CachePolicy;
  imageHandlerLambdaFunction: NodejsFunction;
  existingDistribution: IDistribution;
}

export class S3ObjectLambdaArchitecture {
  public readonly imageHandlerCloudFrontDistribution: Distribution;
  constructor(scope: BackEnd, props: S3ObjectLambdaArchitectureProps) {
    const accessPointName = `sih-ap-${props.uuid}-${props.regionedBucketHash}`;

    const s3AccessPointPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ["s3:*"],
      resources: [
        `arn:aws:s3:${Aws.REGION}:${Aws.ACCOUNT_ID}:accesspoint/${accessPointName}`,
        `arn:aws:s3:${Aws.REGION}:${Aws.ACCOUNT_ID}:accesspoint/${accessPointName}/object/*`,
      ],
      principals: [new ServicePrincipal("cloudfront.amazonaws.com")],
      conditions: {
        "ForAnyValue:StringEquals": {
          "aws:CalledVia": "s3-object-lambda.amazonaws.com",
        },
      },
    }).toJSON();
    const accessPoint = new CfnAccessPoint(scope, "AccessPoint", {
      bucket: props.regionedBucketName,
      name: accessPointName,
      policy: { Statement: s3AccessPointPolicy },
    });
    Aspects.of(accessPoint).add(new ConditionAspect(props.conditions.enableS3ObjectLambdaCondition));

    props.imageHandlerLambdaFunction.grantInvoke(new ServicePrincipal("cloudfront.amazonaws.com"));

    // Slice off the last line since CloudFront functions can't have module exports but we need to export the handler to unit test it.
    const inlineResponseModifierCode: string[] = readFileSync(
      path.join(__dirname, "../../../image-handler/cloudfront-function-handlers/ol-response-modifier.js"),
      "utf-8"
    )
      .split("\n")
      .slice(0, -1);

    const responseModifierCloudFrontFunction = new Function(scope, "OlResponseModifierFunction", {
      code: FunctionCode.fromInline(inlineResponseModifierCode.join("\n")),
      functionName: `sih-ol-response-modifier-${props.uuid}`,
      runtime: FunctionRuntime.JS_2_0,
    });
    Aspects.of(responseModifierCloudFrontFunction).add(
      new ConditionAspect(props.conditions.enableS3ObjectLambdaCondition)
    );

    // Slice off the last line since CloudFront functions can't have module exports but we need to export the handler to unit test it.
    const inlineRequestModifierCode: string[] = readFileSync(
      path.join(__dirname, "../../../image-handler/cloudfront-function-handlers/ol-request-modifier.js"),
      "utf-8"
    )
      .split("\n")
      .slice(0, -1);

    const requestModifierCloudFrontFunction = new Function(scope, "OlRequestModifierFunction", {
      code: FunctionCode.fromInline(inlineRequestModifierCode.join("\n")),
      functionName: `sih-ol-request-modifier-${props.uuid}`,
      runtime: FunctionRuntime.JS_2_0,
    });
    Aspects.of(requestModifierCloudFrontFunction).add(
      new ConditionAspect(props.conditions.enableS3ObjectLambdaCondition)
    );

    const objectLambdaAccessPointName = `sih-olap-${props.uuid}`;
    const objectLambdaAccessPoint = new s3objectlambda.CfnAccessPoint(scope, "ObjectLambdaAccessPoint", {
      objectLambdaConfiguration: {
        supportingAccessPoint: accessPoint.attrArn,
        transformationConfigurations: [
          {
            actions: ["GetObject", "HeadObject"],
            contentTransformation: {
              AwsLambda: {
                FunctionArn: props.imageHandlerLambdaFunction.functionArn,
              },
            },
          },
        ],
      },
      name: objectLambdaAccessPointName,
    });
    Aspects.of(objectLambdaAccessPoint).add(new ConditionAspect(props.conditions.enableS3ObjectLambdaCondition));

    const writeGetObjectResponsePolicy = new Policy(scope, "WriteGetObjectResponsePolicy", {
      statements: [
        new PolicyStatement({
          actions: ["s3-object-lambda:WriteGetObjectResponse"],
          resources: [objectLambdaAccessPoint.attrArn],
        }),
      ],
    });
    Aspects.of(writeGetObjectResponsePolicy).add(new ConditionAspect(props.conditions.enableS3ObjectLambdaCondition));
    props.imageHandlerLambdaFunction.role?.attachInlinePolicy(writeGetObjectResponsePolicy);

    const origin: IOrigin = new S3ObjectLambdaOrigin(
      `${objectLambdaAccessPoint.attrAliasValue}.s3.${Aws.REGION}.amazonaws.com`,
      { originShieldEnabled: true, originShieldRegion: Aws.REGION, originPath: "/image", connectionAttempts: 1 }
    );

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
            function: responseModifierCloudFrontFunction,
            eventType: FunctionEventType.VIEWER_RESPONSE,
          },
          {
            function: requestModifierCloudFrontFunction,
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

    this.imageHandlerCloudFrontDistribution = new Distribution(
      scope,
      "ImageHandlerCloudFrontDistribution",
      cloudFrontDistributionProps
    );
    Aspects.of(this.imageHandlerCloudFrontDistribution).add(
      new ConditionAspect(
        new CfnCondition(scope, "DeployS3OLDistribution", {
          expression: Fn.conditionAnd(
            props.conditions.enableS3ObjectLambdaCondition,
            Fn.conditionNot(props.conditions.useExistingCloudFrontDistributionCondition)
          ),
        })
      )
    );
    addCfnSuppressRules(this.imageHandlerCloudFrontDistribution, [
      {
        id: "W70",
        reason:
          "Since the distribution uses the CloudFront domain name, CloudFront automatically sets the security policy to TLSv1 regardless of the value of MinimumProtocolVersion",
      },
    ]);

    const conditionalCloudFrontDistributionId = Fn.conditionIf(
      props.conditions.useExistingCloudFrontDistributionCondition.logicalId,
      props.existingDistribution.distributionId,
      this.imageHandlerCloudFrontDistribution.distributionId
    ).toString();

    const objectLambdaAccessPointPolicy = new s3objectlambda.CfnAccessPointPolicy(
      scope,
      "ObjectLambdaAccessPointPolicy",
      {
        objectLambdaAccessPoint: objectLambdaAccessPoint.ref,
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "cloudfront.amazonaws.com",
              },
              Action: "s3-object-lambda:Get*",
              Resource: objectLambdaAccessPoint.attrArn,
              Condition: {
                StringEquals: {
                  "aws:SourceArn": `arn:aws:cloudfront::${Aws.ACCOUNT_ID}:distribution/${conditionalCloudFrontDistributionId}`,
                },
              },
            },
          ],
        },
      }
    );

    Aspects.of(objectLambdaAccessPointPolicy).add(new ConditionAspect(props.conditions.enableS3ObjectLambdaCondition));

    const oac = new CfnOriginAccessControl(scope, `SIH-origin-access-control`, {
      originAccessControlConfig: {
        name: `SIH-origin-access-control-${props.uuid}`,
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      },
    });
    Aspects.of(oac).add(new ConditionAspect(props.conditions.enableS3ObjectLambdaCondition));

    const cfnDistribution = this.imageHandlerCloudFrontDistribution.node.defaultChild as CfnDistribution;
    cfnDistribution.addPropertyOverride("DistributionConfig.Origins.0.OriginAccessControlId", oac.attrId);
    cfnDistribution.addOverride("Properties.DistributionConfig.Origins.0.OriginShield", {
      "Fn::If": [
        props.conditions.enableOriginShieldCondition.logicalId,
        { Enabled: true, OriginShieldRegion: props.originShieldRegion },
        { Enabled: false },
      ],
    });
    scope.olDomainName = Fn.conditionIf(
      props.conditions.useExistingCloudFrontDistributionCondition.logicalId,
      props.existingDistribution.distributionDomainName,
      this.imageHandlerCloudFrontDistribution.domainName
    ).toString();
  }
}
