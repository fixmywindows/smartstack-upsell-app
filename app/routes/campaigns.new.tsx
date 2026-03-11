import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "New Campaign - SmartStack" },
    { name: "description", content: "Create a new upsell campaign" },
  ];
};

export default function NewCampaign() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">New Campaign</h1>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow p-8">
          <form className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-900">
                Campaign Name
              </label>
              <input
                type="text"
                id="name"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="e.g., Summer Bundle Offer"
              />
            </div>

            <div>
              <label htmlFor="trigger" className="block text-sm font-medium text-gray-900">
                Trigger Type
              </label>
              <select
                id="trigger"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option>Post-Purchase (Thank You Page)</option>
                <option>Cart Page</option>
              </select>
            </div>

            <div>
              <label htmlFor="method" className="block text-sm font-medium text-gray-900">
                Product Selection Method
              </label>
              <select
                id="method"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option>Manual Selection</option>
                <option>Tag-Based Rules</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-8 rounded-lg transition"
              >
                Continue
              </button>
              <a
                href="/campaigns"
                className="inline-block bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-2 px-8 rounded-lg transition"
              >
                Cancel
              </a>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
