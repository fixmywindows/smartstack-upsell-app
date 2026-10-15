import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function SmartStackApp() {
  const { apiKey } = useLoaderData<typeof loader>();
  return <AppProvider apiKey={apiKey}>
    <NavMenu>
      <a href="/app">Overview</a>
      <a href="/app/catalogue">Catalogue</a>
      <a href="/app/blocks">Recommendation blocks</a>
    </NavMenu>
    <Outlet />
  </AppProvider>;
}
export function ErrorBoundary() { return boundary.error(useRouteError()); }
export const headers: HeadersFunction = (args) => boundary.headers(args);
