// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0


function handler(event) {
    const response = event.response;

    try {
        Object.keys(response.headers).forEach(key => {
            if (key.startsWith("x-amz-meta-") && key !== "x-amz-meta-statuscode") {
                const headerName = key.replace("x-amz-meta-", "");
                response.headers[headerName] = response.headers[key];
                delete response.headers[key];
            }
        });

        const statusCodeHeader = response.headers["x-amz-meta-statuscode"];
        if (statusCodeHeader) {
            const status = parseInt(statusCodeHeader.value);
            if (status >= 400 && status <= 599) {
                response.statusCode = status;
            }

            delete response.headers["x-amz-meta-statuscode"];
        }
    } catch (e) {
        console.log("Error: ", e);
    }
    return response;
}

module.exports = { handler };