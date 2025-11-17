// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Cleans up cdk generated hash in CloudFormation template that would cause snapshot inconsistencies
 * @param templateJson - The CloudFormation template JSON object
 * @returns The cleaned template JSON object
 */
export function cleanTemplateForSnapshot(templateJson: any): any {
  // Clean up dynamic values that would cause snapshot inconsistencies
  Object.keys(templateJson.Resources || {}).forEach((key) => {
    const resource = templateJson.Resources[key];

    // Handle hash keys in template
    if (resource.Properties?.Code?.S3Key) {
      resource.Properties.Code.S3Key = "Omitted to remove snapshot dependency on hash";
    }

    if (resource.Properties?.Code?.S3Bucket) {
      resource.Properties.Code.S3Bucket = "Omitted to remove snapshot dependency on bucket";
    }

    if (resource.Properties?.SourceObjectKeys) {
      resource.Properties.SourceObjectKeys = "Omitted to remove snapshot dependency on hash";
    }

    if (resource.Properties?.TemplateURL) {
      resource.Properties.TemplateURL = "Omitted to remove snapshot dependency on hash";
    }

    if (resource.Properties?.ContainerDefinitions) {
      resource.Properties.ContainerDefinitions[0].Image = "Omitted to remove snapshot dependency on hash";
    }

    if (resource.Properties?.Environment?.Variables?.SOLUTION_VERSION) {
      resource.Properties.Environment.Variables.SOLUTION_VERSION =
        "Omitted to remove snapshot dependency on solution version";
    }

    if (resource.Properties?.ImportSource?.SourceArn) {
      resource.Properties.ImportSource.SourceArn = "Omitted to remove snapshot dependency on bucket";
    }
  });

  Object.keys(templateJson.Outputs || {}).forEach((key) => {
    const output = templateJson.Outputs[key];
    if (key === "ImageUri" && output.Value) {
      output.Value = "Omitted to remove snapshot dependency on hash";
    }
  });

  return templateJson;
}
