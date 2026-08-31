// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const BREAKPOINTS = [320, 480, 768, 1024, 1200, 1440, 1920];

const DEVICE_MAP = [
  // Mobile: 360–430px CSS viewport, predominantly 2x DPR; 480 is the conservative upper breakpoint
  { header: 'cloudfront-is-mobile-viewer',  width: 480,  dpr: 2.0 },
  // Tablet: iPads and Android tablets 768–1024px viewport, typically 2x DPR
  { header: 'cloudfront-is-tablet-viewer',  width: 1024, dpr: 2.0 },
  // Desktop: Tier 4 desktop traffic is primarily Safari/macOS Retina (Chromium desktops use Tier 1/2); 1440 is a safe median, 2.0 reflects Retina prevalence
  { header: 'cloudfront-is-desktop-viewer', width: 1440, dpr: 2.0 },
  // SmartTV: renders at 1080p/4K with 1x CSS pixel density
  { header: 'cloudfront-is-smarttv-viewer', width: 1920, dpr: 1.0 },
];

/** Snaps rawWidth up to the nearest supported breakpoint and rounds/caps rawDpr; null inputs produce null outputs. */
function normalize(raw) {
  let width = null;
  let dpr = null;
  if (raw.rawWidth !== null && raw.rawWidth !== undefined) {
    width = 1920; // rawWidth exceeds largest breakpoint; cap at 1920 (4K/UHD upper bound)
    for (let i = 0; i < BREAKPOINTS.length; i++) {
      if (BREAKPOINTS[i] >= raw.rawWidth) { width = BREAKPOINTS[i]; break; }
    }
  }
  if (raw.rawDpr !== null && raw.rawDpr !== undefined) {
    dpr = Math.min(Math.round(raw.rawDpr * 10) / 10, 5.0);
  }
  return { width, dpr };
}

/** Evaluates the 5-tier detection waterfall and returns the first matching tier's raw width, DPR, tier number, and name. */
function detectTier(request) {
  const headers = request.headers;

  // Tier 1: Sec-CH-Width (responsive image render width — most precise signal)
  const chWidth = headers['sec-ch-width'] && headers['sec-ch-width'].value;
  if (chWidth) {
    const w1 = parseInt(chWidth, 10);
    if (!isNaN(w1) && w1 > 0 && w1 <= 7680) {
      const chDpr = headers['sec-ch-dpr'] && headers['sec-ch-dpr'].value;
      const d1 = parseFloat(chDpr);
      return { rawWidth: w1, rawDpr: (!isNaN(d1) && d1 > 0) ? d1 : null, tier: 1, name: 'ClientHintsWidth' };
    }
  }

  // Tier 2: Sec-CH-Viewport-Width (full viewport width)
  const chVp = headers['sec-ch-viewport-width'] && headers['sec-ch-viewport-width'].value;
  if (chVp) {
    const w2 = parseInt(chVp, 10);
    if (!isNaN(w2) && w2 > 0 && w2 <= 7680) {
      const chDpr2 = headers['sec-ch-dpr'] && headers['sec-ch-dpr'].value;
      const d2 = parseFloat(chDpr2);
      return { rawWidth: w2, rawDpr: (!isNaN(d2) && d2 > 0) ? d2 : null, tier: 2, name: 'ClientHintsViewportWidth' };
    }
  }

  // Tier 3: JS Cookie (dit-device) — deferred to future release

  // Tier 4: CloudFront device-class headers (first match wins: Mobile → Tablet → Desktop → SmartTV)
  for (let i = 0; i < DEVICE_MAP.length; i++) {
    const entry = DEVICE_MAP[i];
    if (headers[entry.header] && headers[entry.header].value === 'true') {
      return { rawWidth: entry.width, rawDpr: entry.dpr, tier: 4, name: 'CloudFrontDevice' };
    }
  }

  // Tier 5: No signal — ECS applies policy fallback
  return { rawWidth: null, rawDpr: null, tier: 5, name: 'Fallback' };
}

/** Emits a single structured DIT-DETECT log entry for the resolved detection result. */
function logDetect(result) {
  console.log(JSON.stringify({
    type: 'DIT-DETECT',
    tier: result.tier,
    name: result.name,
    width: result.width !== null && result.width !== undefined ? String(result.width) : 'unset',
    dpr: result.dpr !== null && result.dpr !== undefined ? String(result.dpr) : 'unset',
  }));
}

// Bound Accept-header parsing to protect the CloudFront Function compute budget.
const MAX_ACCEPT_HEADER_LENGTH = 512;
const MAX_ACCEPT_MIME_TYPES = 20;

const FORMAT_PRIORITY = ['webp', 'avif', 'jpeg', 'png', 'heif', 'tiff', 'raw', 'gif'];

const FORMAT_MAPPING = {
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/jpeg': 'jpeg',
  'image/jpg': 'jpeg',
  'image/png': 'png',
  'image/heif': 'heif',
  'image/heic': 'heif',
  'image/tiff': 'tiff',
  'image/raw': 'raw',
  'image/gif': 'gif'
};

/** Returns the highest-priority supported image MIME type from the Accept header, or null if none match. */
function normalizeAcceptHeader(acceptHeader) {
  if (!acceptHeader || acceptHeader.length > MAX_ACCEPT_HEADER_LENGTH) return null;

  const mimeTypes = acceptHeader
    .split(',', MAX_ACCEPT_MIME_TYPES)
    .map(part => part.split(';')[0].trim().toLowerCase());

  var supportedFormats = [];
  for (var i = 0; i < mimeTypes.length; i++) {
    if (FORMAT_MAPPING[mimeTypes[i]]) {
      supportedFormats.push(FORMAT_MAPPING[mimeTypes[i]]);
    }
  }

  for (var j = 0; j < FORMAT_PRIORITY.length; j++) {
    if (supportedFormats.indexOf(FORMAT_PRIORITY[j]) !== -1) {
      return 'image/' + FORMAT_PRIORITY[j];
    }
  }

  return null;
}

/** CloudFront Function entry point: sets DIT cache-key headers and runs multi-tier device detection. */
async function handler(event) {
  const request = event.request;
  const headers = request.headers;

  // Strip inbound 'dit-*' headers so a viewer can't inject the origin-override or poison the
  // cache-key headers this function derives below. Keyed on the 'dit-' prefix since the configured
  // override header name isn't visible to this static function. ('x-dit-sim-*' is untouched.)
  Object.keys(headers).forEach(function (name) {
    if (name.indexOf('dit-') === 0) {
      delete headers[name];
    }
  });

  // dit-host: always mirrors the Host header. Included in the DIT cache policy
  // so that image caching is keyed on DIT-specific headers only, isolating it
  // from unrelated headers.
  if (headers['host']) {
    request.headers['dit-host'] = { value: headers['host'].value };
  }

  // Derive cache-key headers inside one try/catch so viewer-input parsing fails open, not 503.
  try {
    // dit-accept: best supported image format from Accept; skipped when format is explicit in the query string.
    if (headers['accept'] && !(request.querystring && request.querystring.format)) {
      const normalizedFormat = normalizeAcceptHeader(headers['accept'].value);
      if (normalizedFormat) {
        request.headers['dit-accept'] = { value: normalizedFormat };
      }
    }

    // dit-viewport-width / dit-dpr: device dimensions via the 5-tier waterfall.
    const raw = detectTier(request);
    const norm = normalize(raw);
    if (norm.width !== null) {
      request.headers['dit-viewport-width'] = { value: String(norm.width) };
    }
    if (norm.dpr !== null) {
      request.headers['dit-dpr'] = { value: String(norm.dpr) };
    }
    logDetect({ tier: raw.tier, name: raw.name, width: norm.width, dpr: norm.dpr });
  } catch (e) {
    // Fail-open: pass through with whatever headers were successfully set before the exception.
    console.error('DIT Function - Error processing request:', e);
  }

  // dit-origin: optional header for custom origin routing. Header defined here (dit-origin), should match
  // the value of the 'OriginOverrideHeader' CloudFormation parameter configured at deployment.
  // Set only by this deployment's own logic — any client-supplied value was stripped above.
  // Example: request.headers['dit-origin'] = { value: 'my-custom-origin' };

  return request;
}
