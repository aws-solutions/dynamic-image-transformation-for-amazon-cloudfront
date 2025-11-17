// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface OutputOption {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface Output {
  type: string;
  value: any;
}

export interface TransformationOption {
  id: string;
  title: string;
  description: string;
  category: 'basic' | 'effects' | 'advanced';
}