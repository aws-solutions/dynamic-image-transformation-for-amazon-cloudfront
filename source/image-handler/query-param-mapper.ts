// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageEdits, ImageHandlerError, QueryStringParameters, StatusCodes } from "./lib";

export class QueryParamMapper {
  mapToBoolean = (value: string): boolean => value === "true";

  private static readonly QUERY_PARAM_MAPPING: Record<
    string,
    { path: string[]; key: string; transform?: (value: string) => string | number | boolean }
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

  // dpr is handled separately from QUERY_PARAM_MAPPING because it scales the
  // resize dimensions rather than mapping to its own edit key.
  private static readonly DPR_PARAM = "dpr";

  private static readonly MAX_DPR = 4;

  public static readonly QUERY_PARAM_KEYS = [...Object.keys(this.QUERY_PARAM_MAPPING), this.DPR_PARAM];

  /**
   * Initializer function for creating a new Thumbor mapping, used by the image
   * handler to perform image modifications based on legacy URL path requests.
   * @param queryParameters The query parameter provided alongside the request.
   * @returns Image edits included due to the provided query parameter.
   */
  public mapQueryParamsToEdits(queryParameters: QueryStringParameters): ImageEdits {
    try {
      type Result = {
        [x: string]: string | number | boolean | Result;
      };
      const result: Result = {};

      Object.entries(queryParameters).forEach(([param, value]) => {
        if (value !== undefined && QueryParamMapper.QUERY_PARAM_MAPPING[param]) {
          const { path, key, transform } = QueryParamMapper.QUERY_PARAM_MAPPING[param];

          // Traverse and create nested objects as needed
          let current: Result = result;
          for (const segment of path) {
            current[segment] = current[segment] || {};
            current = current[segment] as Result;
          }

          if (transform) {
            value = transform(value);
          }
          // Assign the value at the final destination
          current[key] = value;
        }
      });

      this.applyDpr(result, queryParameters[QueryParamMapper.DPR_PARAM]);

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

  /**
   * Scales the resize dimensions by the requested device pixel ratio.
   * Invalid values (non-numeric, zero, or negative) are ignored; values above MAX_DPR are clamped.
   * @param edits The edits object produced from the query parameters.
   * @param dprValue The raw dpr query parameter value.
   */
  private applyDpr(edits: ImageEdits, dprValue?: string): void {
    if (dprValue === undefined || !edits.resize) {
      return;
    }
    const dpr = parseFloat(dprValue);
    if (isNaN(dpr) || dpr <= 0) {
      return;
    }
    const clampedDpr = Math.min(dpr, QueryParamMapper.MAX_DPR);
    for (const dimension of ["width", "height"]) {
      if (typeof edits.resize[dimension] === "number") {
        edits.resize[dimension] = Math.round(edits.resize[dimension] * clampedDpr);
      }
    }
  }
}

/**
 * Converts a string to a boolean value, using a list a defined falsy values
 * @param input The input string to be converted
 * @returns The boolean value of the input string
 */
function stringToBoolean(input: string): boolean {
  const falsyValues = ["0", "false", ""];
  return !falsyValues.includes(input.toLowerCase());
}

/**
 * Converts a string to an integer value, or null if the string is empty
 * @param input The input string to be converted
 * @returns The integer value of the input string, or null if the input is an empty string
 */
function stringToNullInt(input: string): number | null {
  return input === "" ? null : parseInt(input);
}

/**
 * Converts a string to an integer value, or null if the string is empty or "0"
 * @param input The input string to be converted
 * @returns The integer value of the input string, or null if the input is an empty string or "0"
 */
function zeroStringToNullInt(input: string): number | null {
  return input === "0" ? null : stringToNullInt(input);
}
