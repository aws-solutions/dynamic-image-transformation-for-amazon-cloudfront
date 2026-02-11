// CloudFront Function: Normalize Accept header to binary fmt query parameter
// This reduces cache fragmentation by normalizing varying Accept headers into two cache entries: avif or jpeg
function handler(event) {
  var request = event.request;
  var headers = request.headers;

  // Only add fmt if not already present
  if (!request.querystring.fmt) {
    // Determine format based on Accept header
    var fmt = "jpeg"; // default
    if (headers["accept"] && headers["accept"].value.includes("image/avif")) {
      fmt = "avif";
    }

    // Add normalized format to query string (becomes part of cache key)
    request.querystring.fmt = { value: fmt };
  }

  return request;
}
