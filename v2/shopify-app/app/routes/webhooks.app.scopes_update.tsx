import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, payload } = await authenticate.webhook(request);
  if (session) {
    const scopes = (payload as { current?: string[] }).current ?? [];
    await db.session.updateMany({ where: { id: session.id }, data: { scope: scopes.join(",") } });
  }
  return new Response();
};
