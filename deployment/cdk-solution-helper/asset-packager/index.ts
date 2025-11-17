/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { CDKAssetPackager } from "./asset-packager";

export async function handler(cdkAssetFolderPath: string | undefined, outputPath: string | undefined) {
  if (!cdkAssetFolderPath || !outputPath) throw new Error("undefined input path");
  const assetPackager = new CDKAssetPackager(cdkAssetFolderPath);
  const assetPaths = await assetPackager.getAssetPaths();
  for (const path of assetPaths) {
    await assetPackager.createAssetZip(path);
  }
  await assetPackager.moveZips(outputPath);
}

if (require.main === module) {
  // this module was run directly from the command line, getting command line arguments
  // e.g. npx ts-node index.ts cdkAssetPath outputPath
  const cdkAssetPath = process.argv[2];
  const outputPath = process.argv[3];
  handler(cdkAssetPath, outputPath)
    .then(() => console.log("all assets packaged"))
    .catch((err) => {
      console.error(err);
      throw err;
    });
}
