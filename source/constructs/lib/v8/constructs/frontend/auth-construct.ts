// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Aws, CfnOutput, CfnParameter, Duration, RemovalPolicy } from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import { Mfa, OAuthScope } from "aws-cdk-lib/aws-cognito";
import { Construct } from "constructs";

interface AuthConstructProps {
  domainName: string;
  region: string;
  userEmail: CfnParameter;
}

export class AuthConstruct extends Construct {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly cognitoDomainUrl: string;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    const createInvitationEmailBody = () => {
      return (
        "<p>Dynamic Image Transformation on Amazon CloudFront - Web UI</p>" +
        "<p>Here are your temporary login credentials for the WebUI: https://" +
        props.domainName +
        "</p>\n" +
        "<p>\n" +
        "Region: " +
        props.region +
        "<br />\n" +
        "Username: <strong>{username}</strong><br />\n" +
        "Temporary Password: <strong>{####}</strong>\n" +
        "</p>"
      );
    };

    this.userPool = new cognito.UserPool(this, "UserPool", {
      userInvitation: {
        emailSubject: "Welcome to DIT",
        emailBody: createInvitationEmailBody(),
      },
      userVerification: {
        emailSubject: "Your Dynamic Image Transformation console verification code",
        emailBody: "Your Dynamic Image Transformation console verification code is {####}",
      },
      signInAliases: {
        email: true,
      },
      selfSignUpEnabled: false,
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(7),
      },
      mfa: Mfa.REQUIRED,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      removalPolicy: this.node.tryGetContext("environment") === "dev" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });

    // Configure the new managed login experience
    const cfnUserPool = this.userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.userPoolAddOns = {
      advancedSecurityMode: "ENFORCED",
    };

    // creating scope for REST API to be added to access tokens and allow authenticated users to invoke DIT API
    const apiAccessScope = {
      scopeName: "api",
      scopeDescription: "Access to solution API",
    };
    const resourceServer = this.userPool.addResourceServer("ResourceServer", {
      identifier: "dit-api",
      userPoolResourceServerName: "Resource server representing the API Gateway of the solution",
      scopes: [apiAccessScope],
    });

    const domainPrefix = `dit-${Aws.ACCOUNT_ID}-${Aws.REGION}`;
    const userPoolDomain = this.userPool.addDomain("UserPoolDomain", {
      cognitoDomain: {
        domainPrefix,
      },
      managedLoginVersion: cognito.ManagedLoginVersion.NEWER_MANAGED_LOGIN,
    });

    this.cognitoDomainUrl = `${domainPrefix}.auth.${props.region}.amazoncognito.com`;

    const cloudFrontUrl = `https://${props.domainName}/`;
    const cloudFrontLogOutUrl = `https://${props.domainName}/auth/logout-complete`;
    this.userPoolClient = this.userPool.addClient("WebUIClient", {
      authFlows: {
        userSrp: true,
      },
      refreshTokenValidity: Duration.minutes(60),
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
      oAuth: {
        callbackUrls: [cloudFrontUrl],
        logoutUrls: [cloudFrontUrl, cloudFrontLogOutUrl],
        flows: {
          authorizationCodeGrant: true,
        },
        scopes: [
          OAuthScope.OPENID,
          OAuthScope.PROFILE,
          OAuthScope.EMAIL,
          OAuthScope.COGNITO_ADMIN,
          OAuthScope.custom("dit-api/api"),
        ],
      },
    });

    this.userPoolClient.node.addDependency(resourceServer);

    new cognito.CfnManagedLoginBranding(this, "ManagedLoginBranding", {
      userPoolId: this.userPool.userPoolId,
      clientId: this.userPoolClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });

    new cognito.CfnUserPoolUser(this, "InitialFullAccessUser", {
      userPoolId: this.userPool.userPoolId,
      username: props.userEmail.valueAsString,
      userAttributes: [
        {
          name: "email_verified",
          value: "true",
        },
        {
          name: "email",
          value: props.userEmail.valueAsString,
        },
      ],
    });

    new CfnOutput(this, "CognitoDomainPrefix", {
      value: domainPrefix,
      description: "Cognito Domain Prefix",
    });

    new CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
    });
  }
}
