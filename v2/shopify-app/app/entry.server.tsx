import type { AppLoadContext, EntryContext } from "react-router";
import { handleRequest as vercelHandleRequest } from "@vercel/react-router/entry.server";
import { addDocumentResponseHeaders } from "./shopify.server";
export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext,
  loadContext?: AppLoadContext,
): Promise<Response> {
  addDocumentResponseHeaders(request, headers);
  return vercelHandleRequest(request, status, headers, context, loadContext);
}
