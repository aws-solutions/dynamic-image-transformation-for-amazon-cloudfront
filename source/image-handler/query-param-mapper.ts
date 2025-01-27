// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageEdits, ImageHandlerError, QueryStringParameters, StatusCodes } from "./lib";

export class QueryParamMapper {
  mapToBoolean = (value: string): boolean => {
    return value === "true";
  };
  private static readonly QUERY_PARAM_MAPPING: Record<
    string,
    { path: string[]; key: string; transform?: (value: string) => any }
  > = {
    format: { path: [], key: "toFormat" },
    fit: { path: ["resize"], key: "fit" },
    width: { path: ["resize"], key: "width", transform: zeroStringToNullInt },
    height: { path: ["resize"], key: "height", transform: zeroStringToNullInt },
    rotate: { path: [], key: "rotate", transform: stringToNullInt },
    flip: { path: [], key: "flip", transform: stringToBoolean },
    flop: { path: [], key: "flop", transform: stringToBoolean },
    grayscale: { path: [], key: "greyscale", transform: stringToBoolean },
    greyscale: { path: [], key: "greyscale", transform: stringToBoolean },
  };
  public static readonly QUERY_PARAM_KEYS = Object.keys(this.QUERY_PARAM_MAPPING);

  /**
   * Initializer function for creating a new Thumbor mapping, used by the image
   * handler to perform image modifications based on legacy URL path requests.
   * @param path The request path.
   * @returns Image edits based on the request path.
   */
  public mapQueryParamsToEdits(queryParameters: QueryStringParameters): ImageEdits {
    try {
      const result: Record<string, any> = {};

      Object.entries(queryParameters).forEach(([param, value]) => {
        if (value !== undefined && QueryParamMapper.QUERY_PARAM_MAPPING[param]) {
          const { path, key, transform } = QueryParamMapper.QUERY_PARAM_MAPPING[param];

          // Traverse and create nested objects as needed
          let current = result;
          for (const segment of path) {
            current[segment] = current[segment] || {};
            current = current[segment];
          }

          if (transform) {
            value = transform(value);
          }
          // Assign the value at the final destination
          current[key] = value;
        }
      });

      return result;
    } catch (error) {
      console.error(error);
      throw new ImageHandlerError(
        StatusCodes.BAD_REQUEST,
        "QueryParameterParsingError",
        "Query parameter parsing failed"
      );
    }
  }
}

function stringToBoolean(input: string): boolean {
  const falsyValues = ["0", "false", ""];
  return !falsyValues.includes(input.toLowerCase());
}

function stringToNullInt(input: string): number | null {
  return input === "" ? null : parseInt(input);
}

function zeroStringToNullInt(input: string): number | null {
  return input === "0" ? null : stringToNullInt(input);
}
