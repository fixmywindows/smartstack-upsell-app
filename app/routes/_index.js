import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "@remix-run/react";
export const meta = () => {
    return [
        { title: "SmartStack - Shopify Upsell App" },
        {
            name: "description",
            content: "Flexible upsell and cross-sell solutions for Shopify stores",
        },
    ];
};
export default function Index() {
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100", children: [_jsx("nav", { className: "bg-white shadow", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4", children: _jsx("h1", { className: "text-2xl font-bold text-gray-900", children: "SmartStack" }) }) }), _jsxs("main", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12", children: [_jsxs("div", { className: "bg-white rounded-lg shadow-lg p-8", children: [_jsx("h2", { className: "text-3xl font-bold text-gray-900 mb-4", children: "Welcome to SmartStack" }), _jsx("p", { className: "text-gray-600 text-lg mb-6", children: "The flexible upsell and cross-sell engine for Shopify" }), _jsx("p", { className: "text-gray-700 mb-8", children: "SmartStack helps you increase average order value with intuitive product recommendations. Choose between manual selection, tag-based rules, or AI suggestions." }), _jsxs("div", { className: "flex gap-4", children: [_jsx(Link, { to: "/auth/callback?shop=example.myshopify.com", className: "inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-8 rounded-lg transition", children: "Install App" }), _jsx(Link, { to: "/dashboard", className: "inline-block bg-gray-200 hover:bg-gray-300 text-gray-900 font-semibold py-3 px-8 rounded-lg transition", children: "Dashboard" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-8 mt-12", children: [_jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-3", children: "\uD83C\uDFAF Manual Selection" }), _jsx("p", { className: "text-gray-600", children: "Handpick specific products to recommend to your customers" })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-3", children: "\uD83C\uDFF7\uFE0F Tag-Based Rules" }), _jsx("p", { className: "text-gray-600", children: "Create rules using Shopify tags for automatic recommendations" })] }), _jsxs("div", { className: "bg-white rounded-lg shadow p-6", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-3", children: "\uD83D\uDCCA Analytics" }), _jsx("p", { className: "text-gray-600", children: "Track revenue, conversions, and AOV impact in real-time" })] })] })] })] }));
}
