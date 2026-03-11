import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [
    { title: "Campaigns - SmartStack" },
    { name: "description", content: "Manage your upsell campaigns" },
  ];
};

export default function Campaigns() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
            <a
              href="/campaigns/new"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition"
            >
              + New Campaign
            </a>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-12 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              No campaigns yet
            </h2>
            <p className="text-gray-600 mb-6">
              Create your first upsell campaign to get started
            </p>
            <a
              href="/campaigns/new"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Create Your First Campaign
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
