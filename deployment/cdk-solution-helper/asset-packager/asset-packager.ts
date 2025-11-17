/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { readdir, lstat, rename } from "node:fs/promises";
import path from "path";
import AdmZip from "adm-zip";

/**
 * @description Class to help with packaging and staging cdk assets
 * on solution internal pipelines
 */
export class CDKAssetPackager {
  constructor(private readonly assetFolderPath: string) { }

  /**
   * @description get cdk asset paths
   * All cdk generated assets are prepended with "asset"
   */
  async getAssetPaths() {
    try {
      const allFiles = await readdir(this.assetFolderPath);
      const assetFilePaths = allFiles
        .filter((file) => file.includes("asset"))
        .map((file) => path.join(this.assetFolderPath, file));
      return assetFilePaths;
    } catch (err) {
      console.error(err);
      return [];
    }
  }

  /**
   * @description creates zip from folder
   * @param folderPath
   */
  async createAssetZip(folderPath: string) {
    const isDir = (await lstat(folderPath)).isDirectory();
    if (isDir) {
      const zip = new AdmZip();
      zip.addLocalFolder(path.join(folderPath, "./"));
      const zipName = `${folderPath.split("/").pop()}.zip`;
      zip.writeZip(path.join(this.assetFolderPath, zipName));
    }
  }

  /**
   * @description moves zips to staging output directory in internal pipelines
   * @param outputPath
   */
  async moveZips(outputPath: string) {
    const allFiles = await readdir(this.assetFolderPath);
    const allZipPaths = allFiles.filter((file) => path.extname(file) === ".zip");
    for (const zipPath of allZipPaths) {
      await rename(path.join(this.assetFolderPath, zipPath), path.join(outputPath, zipPath.split("asset.").pop()!));
      // remove cdk prepended string "asset.*"
    }
  }
}
