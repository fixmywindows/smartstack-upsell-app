import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";

export const meta: MetaFunction = () => {
  return [
    { title: "SmartStack - Shopify Upsell App" },
    {
      name: "description",
      content: "Flexible upsell and cross-sell solutions for Shopify stores",
    },
  ];
};

export default function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">SmartStack</h1>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Welcome to SmartStack
          </h2>
          <p className="text-gray-600 text-lg mb-6">
            The flexible upsell and cross-sell engine for Shopify
          </p>
          <p className="text-gray-700 mb-8">
            SmartStack helps you increase average order value with intuitive
            product recommendations. Choose between manual selection, tag-based
            rules, or AI suggestions.
          </p>

          <div className="flex gap-4">
            <Link
              to="/auth/callback?shop=example.myshopify.com"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition"
            >
              Install App
            </Link>
            <Link
              to="/dashboard"
              className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-8 rounded-lg transition"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              🎯 Manual Selection
            </h3>
            <p className="text-gray-600">
              Handpick specific products to recommend to your customers
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              🏷️ Tag-Based Rules
            </h3>
            <p className="text-gray-600">
              Create rules using Shopify tags for automatic recommendations
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              📊 Analytics
            </h3>
            <p className="text-gray-600">
              Track revenue, conversions, and AOV impact in real-time
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
