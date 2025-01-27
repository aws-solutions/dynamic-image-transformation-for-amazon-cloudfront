// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ImageHandlerError } from "../../lib";
import { QueryParamMapper } from "../../query-param-mapper";

describe("QueryParamMapper", () => {
  let mapper: QueryParamMapper;

  beforeEach(() => {
    mapper = new QueryParamMapper();
  });

  describe("mapQueryParamsToEdits", () => {
    it("should map format parameter correctly", () => {
      const result = mapper.mapQueryParamsToEdits({ format: "jpeg" });
      expect(result).toEqual({ toFormat: "jpeg" });
    });

    it("should map resize parameters correctly", () => {
      const result = mapper.mapQueryParamsToEdits({
        width: "100",
        height: "200",
        fit: "cover",
      });
      expect(result).toEqual({
        resize: {
          width: 100,
          height: 200,
          fit: "cover",
        },
      });
    });

    it("should map zeroed width parameters to null", () => {
      const result = mapper.mapQueryParamsToEdits({
        width: "0",
        height: "200",
        fit: "cover",
      });
      expect(result).toEqual({
        resize: {
          width: null,
          height: 200,
          fit: "cover",
        },
      });
    });

    it("should transform boolean parameters correctly, should map grayscale to greyscale", () => {
      const result = mapper.mapQueryParamsToEdits({
        flip: "true",
        flop: "false",
        grayscale: "true",
      });
      expect(result).toEqual({
        flip: true,
        flop: false,
        greyscale: true,
      });
    });

    it("should transform rotate parameter correctly", () => {
      const result = mapper.mapQueryParamsToEdits({
        rotate: "90",
      });
      expect(result).toEqual({
        rotate: 90,
      });
    });

    it("should handle empty rotate value", () => {
      const result = mapper.mapQueryParamsToEdits({
        rotate: "",
      });
      expect(result).toEqual({
        rotate: null,
      });
    });

    it("should ignore undefined values", () => {
      const result = mapper.mapQueryParamsToEdits({
        format: undefined,
        width: "100",
      });
      expect(result).toEqual({
        resize: {
          width: 100,
        },
      });
    });

    it("should ignore unknown parameters", () => {
      const result = mapper.mapQueryParamsToEdits({
        // @ts-ignore
        unknown: "value",
        width: "100",
      });
      expect(result).toEqual({
        resize: {
          width: 100,
        },
      });
    });

    it("should throw ImageHandlerError on parsing failure", () => {
      // Mock console.error to avoid logging during test
      console.error = jest.fn();

      // Force an error by passing invalid input
      const invalidInput = null as any;

      expect(() => {
        mapper.mapQueryParamsToEdits(invalidInput);
      }).toThrow(ImageHandlerError);

      expect(() => {
        mapper.mapQueryParamsToEdits(invalidInput);
      }).toThrow("Query parameter parsing failed");
    });
  });

  describe("stringToBoolean helper", () => {
    it('should return false for "false" and "0"', () => {
      const result1 = mapper.mapQueryParamsToEdits({ flip: "false" });
      const result2 = mapper.mapQueryParamsToEdits({ flip: "0" });

      expect(result1).toEqual({ flip: false });
      expect(result2).toEqual({ flip: false });
    });

    it("should return true for other values", () => {
      const result1 = mapper.mapQueryParamsToEdits({ flip: "true" });
      const result2 = mapper.mapQueryParamsToEdits({ flip: "1" });

      expect(result1).toEqual({ flip: true });
      expect(result2).toEqual({ flip: true });
    });
  });

  describe("QUERY_PARAM_KEYS", () => {
    it("should contain all supported parameter keys", () => {
      expect(QueryParamMapper.QUERY_PARAM_KEYS).toContain("format");
      expect(QueryParamMapper.QUERY_PARAM_KEYS).toContain("fit");
      expect(QueryParamMapper.QUERY_PARAM_KEYS).toContain("width");
      expect(QueryParamMapper.QUERY_PARAM_KEYS).toContain("height");
      expect(QueryParamMapper.QUERY_PARAM_KEYS).toContain("rotate");
      expect(QueryParamMapper.QUERY_PARAM_KEYS).toContain("flip");
      expect(QueryParamMapper.QUERY_PARAM_KEYS).toContain("flop");
      expect(QueryParamMapper.QUERY_PARAM_KEYS).toContain("grayscale");
    });
  });
});
