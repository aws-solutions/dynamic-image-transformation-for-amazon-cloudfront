// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Credit to xpepermint: https://github.com/xpepermint/query-types

function isObject(val) {
  return val.constructor === Object;
}

function isNumber(val) {
  return !isNaN(parseFloat(val)) && isFinite(val);
}

function isBoolean(val) {
  return val === 'false' || val === 'true';
}

function isArray(val) {
  return Array.isArray(val);
}

function parseValue(val) {
  if (typeof val == 'undefined' || val == '') {
    return null;
  } else if (typeof val === 'string' && (val.includes('[') || val.includes(','))) {
    return parseNestedArray(val);
  } else if (isBoolean(val)) {
    return parseBoolean(val);
  } else if (isArray(val)) {
    return parseArray(val);
  } else if (isObject(val)) {
    return parseObject(val);
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
    if (val !== null) result[key] = val;
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
  return val === 'true';
}

function parseNestedArray(val) {
  // If no brackets and has comma, treat as simple comma-separated array
  if (!val.includes('[') && val.includes(',')) {
    return val.split(',').map(item => parseValue(item.trim()));
  }
  
  // Strip outer brackets if entire string is wrapped
  if (val.startsWith('[') && val.endsWith(']')) {
    val = val.slice(1, -1);
  }
  
  const parts = [];
  let current = '';
  let bracketDepth = 0;
  
  for (let i = 0; i < val.length; i++) {
    const char = val[i];
    
    if (char === '[') {
      bracketDepth++;
      current += char;
    } else if (char === ']') {
      bracketDepth--;
      current += char;
    } else if (char === ',' && bracketDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current) parts.push(current.trim());
  
  const result = parts.map(part => {
    if (part.startsWith('[') && part.endsWith(']')) {
      const inner = part.slice(1, -1);
      return inner.split(',').map(item => parseValue(item.trim()));
    }
    return parseValue(part);
  });
  
  return result;
}

function queryTypesMiddleware() {
  return function(req, res, next) {
    const qs = require('qs');
    const queryString = req.url.split('?')[1] || '';

    const parsedQuery = qs.parse(queryString, {
      parameterLimit: 50,
      depth: 2,
      arrayLimit: 10,
      ignoreQueryPrefix: true,
      comma: false
    });
    
    req.query = parseObject(parsedQuery);
    next();
  }
}

export { queryTypesMiddleware };