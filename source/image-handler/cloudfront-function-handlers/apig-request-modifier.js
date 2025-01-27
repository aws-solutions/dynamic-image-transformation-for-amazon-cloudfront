// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0


function handler(event) {
    // Normalize accept header to only include values used on the backend
    if(event.request.headers && event.request.headers.accept && event.request.headers.accept.value) {
        event.request.headers.accept.value = event.request.headers.accept.value.indexOf("image/webp") > -1 ? "image/webp" : ""
    }
    event.request.querystring = processQueryParams(event.request.querystring).join('&')
    return event.request;
}

function processQueryParams(querystring) {
    if (querystring == null) {
        return [];
    }

    const ALLOWED_PARAMS = ['signature', 'expires', 'format', 'fit', 'width', 'height', 'rotate', 'flip', 'flop', 'grayscale'];
    
    let qs = [];
    for (const key in querystring) {
        if (!ALLOWED_PARAMS.includes(key)) {
            continue;
        }
        const value = querystring[key];
        qs.push(
            value.multiValue
                ? `${key}=${value.multiValue[value.multiValue.length - 1].value}`
                : `${key}=${value.value}`
        )
    }

    return qs.sort();
}
module.exports = { handler };