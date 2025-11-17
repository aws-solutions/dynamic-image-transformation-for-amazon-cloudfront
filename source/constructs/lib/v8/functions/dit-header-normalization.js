// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

async function handler(event) {
  var request = event.request;
  var headers = request.headers;

  console.log("DIT Function - Processing request:", JSON.stringify(event, null, 2));

  try {
    // Get header mapping configuration from KVS
    const ditHostHeader = "dit-host";
    const ditAcceptHeader = "dit-accept";
    const ditDprHeader = "dit-dpr";
    const ditViewportWidthHeader = "dit-viewport-width";
    const ditOriginHeader = ""; // eg. dit-origin
    const viewportBreakpoints = "320,480,768,1024,1200,1440,1920";

    // Parse viewport breakpoints
    const breakpoints = viewportBreakpoints
      ? viewportBreakpoints
          .split(",")
          .map(Number)
          .sort((a, b) => a - b)
      : [320, 480, 768, 1024, 1200, 1440, 1920];

    // Normalize viewport width to nearest breakpoint and map to DIT header
    if (headers["sec-ch-viewport-width"] && ditViewportWidthHeader) {
      const viewportWidth = parseInt(headers["sec-ch-viewport-width"]["value"]);
      let normalizedWidth = breakpoints[0]; // Default to smallest

      for (let i = 0; i < breakpoints.length; i++) {
        if (viewportWidth <= breakpoints[i]) {
          normalizedWidth = breakpoints[i];
          break;
        }
        if (i === breakpoints.length - 1) {
          normalizedWidth = breakpoints[i]; // Use the largest if exceeds all
        }
      }

      // Set normalized viewport width header
      request.headers[ditViewportWidthHeader] = { value: normalizedWidth.toString() };
    }

    // Map standard headers to DIT headers for cache key optimization
    if (headers["host"] && ditHostHeader) {
      request.headers[ditHostHeader] = { value: headers["host"]["value"] };
    }

    if (headers["accept"] && ditAcceptHeader) {
      request.headers[ditAcceptHeader] = { value: headers["accept"]["value"] };
    }

    // Normalize DPR values to nearest tenth and cap at 5.0
    if (headers["sec-ch-dpr"] && ditDprHeader) {
      const dprValue = parseFloat(headers["sec-ch-dpr"]["value"]);
      const normalizedDpr = Math.min(Math.round(dprValue * 10) / 10, 5.0);
      request.headers[ditDprHeader] = { value: normalizedDpr.toString() };
    }

    // Customer-specific origin header mapping (placeholder for extension)
    // Customers can extend this logic to set dit-origin based on their routing needs
    if (ditOriginHeader) {
      // Example: Set based on host or custom logic
      // request.headers[ditOriginHeader] = { "value": "custom-origin-value" };
    }

    console.log("DIT Function - Processed headers:", JSON.stringify(request.headers, null, 2));
  } catch (error) {
    console.error("DIT Function - Error processing request:", error);
    // Continue with original request on error
  }

  return request;
}
