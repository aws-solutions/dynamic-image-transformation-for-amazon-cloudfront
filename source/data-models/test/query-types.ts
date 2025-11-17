// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// https://github.com/xpepermint/query-types/blob/master/index.js

module.exports.parseObject = parseObject;

function isObject(val) {
  return val.constructor === Object;
}

function isNumber(val) {
  return !isNaN(parseFloat(val)) && isFinite(val);
}

function isBoolean(val) {
  return val === 'false' || val === 'true' || val === ''; // treat empty strings as true to support query strings without value
}

function isArray(val) {
  return Array.isArray(val);
}

function isJsonString(val) {
  return typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'));
}

function parseValue(val) {
  if (typeof val == 'undefined') {
    return null;
  } else if (isBoolean(val)) {
    return parseBoolean(val);
  } else if (isArray(val)) {
    return parseArray(val);
  } else if (isObject(val)) {
    return parseObject(val);
  } else if (isJsonString(val)) { // to support number array in query strings like ?extract=[20,20,100,100]
    try {
      return JSON.parse(val);
    } catch {
      return val; // return as string if JSON parsing fails
    }
  } else if (isNumber(val)) {
    return parseNumber(val);
  } else {
    return val;
  }
}

function parseObject(obj) {
  var result = {};
  var key, val;
  for (key in obj) {
    val = parseValue(obj[key]);
    if (val !== null) result[key] = val; // ignore null values
  }
  return result;
}

function parseArray(arr) {
  var result = [];
  for (var i = 0; i < arr.length; i++) {
    result[i] = parseValue(arr[i]);
  }
  return result;
}

function parseNumber(val) {
  return Number(val);
}

function parseBoolean(val) {
  return val === 'true' || val === ''; // treat empty strings as true
}

function middleware() {
  return function(req, res, next) {
    req.query = parseObject(req.query);
    next();
  }
}