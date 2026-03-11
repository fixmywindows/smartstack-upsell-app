import { jsx as _jsx } from "react/jsx-runtime";
import { renderToPipeableStream } from "react-dom/server";
import { RemixServer } from "@remix-run/react";
const ABORT_DELAY = 5000;
export default function handleRequest(request, responseStatusCode, responseHeaders, remixContext, loadContext) {
    return new Promise((resolve, reject) => {
        const { pipe, abort } = renderToPipeableStream(_jsx(RemixServer, { context: remixContext, url: request.url }), {
            onShellReady() {
                responseHeaders.set("Content-Type", "text/html");
                resolve(new Response(pipe, {
                    status: responseStatusCode,
                    headers: responseHeaders,
                }));
            },
            onShellError(error) {
                reject(error);
            },
            onError(error) {
                responseStatusCode = 500;
                console.error(error);
            },
        });
        setTimeout(abort, ABORT_DELAY);
    });
}
