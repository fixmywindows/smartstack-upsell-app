import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const meta = () => {
    return [
        { title: "Campaigns - SmartStack" },
        { name: "description", content: "Manage your upsell campaigns" },
    ];
};
export default function Campaigns() {
    return (_jsxs("div", { className: "min-h-screen bg-gray-50", children: [_jsx("nav", { className: "bg-white shadow", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "Campaigns" }), _jsx("a", { href: "/campaigns/new", className: "inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-lg transition", children: "+ New Campaign" })] }) }) }), _jsx("main", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12", children: _jsx("div", { className: "bg-white rounded-lg shadow", children: _jsxs("div", { className: "px-6 py-12 text-center", children: [_jsx("h2", { className: "text-2xl font-semibold text-gray-900 mb-2", children: "No campaigns yet" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Create your first upsell campaign to get started" }), _jsx("a", { href: "/campaigns/new", className: "inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-6 rounded-lg transition", children: "Create Your First Campaign" })] }) }) })] }));
}
