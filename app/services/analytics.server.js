/**
 * Analytics Service
 * Handles analytics data aggregation and retrieval
 */
import { prisma } from "~/db.server";
/**
 * Get analytics for a shop
 */
export async function getAnalytics(shopId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return prisma.analytics.findMany({
        where: {
            shopId,
            date: {
                gte: startDate,
            },
        },
        orderBy: { date: "asc" },
    });
}
/**
 * Get analytics for a specific campaign
 */
export async function getCampaignAnalytics(campaignId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return prisma.analytics.findMany({
        where: {
            campaignId,
            date: {
                gte: startDate,
            },
        },
        orderBy: { date: "asc" },
    });
}
/**
 * Record a view event
 */
export async function recordView(shopId, campaignId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return prisma.analytics.upsert({
        where: {
            shopId_date_campaignId: {
                shopId,
                date: today,
                campaignId,
            },
        },
        create: {
            shopId,
            campaignId,
            date: today,
            views: 1,
        },
        update: {
            views: {
                increment: 1,
            },
        },
    });
}
/**
 * Record a conversion event
 */
export async function recordConversion(shopId, campaignId, revenue) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return prisma.analytics.upsert({
        where: {
            shopId_date_campaignId: {
                shopId,
                date: today,
                campaignId,
            },
        },
        create: {
            shopId,
            campaignId,
            date: today,
            conversions: 1,
            revenue,
        },
        update: {
            conversions: {
                increment: 1,
            },
            revenue: {
                increment: revenue,
            },
        },
    });
}
/**
 * Get total stats for a shop
 */
export async function getShopStats(shopId) {
    const stats = await prisma.analytics.aggregate({
        where: { shopId },
        _sum: {
            views: true,
            conversions: true,
            revenue: true,
        },
    });
    return {
        totalViews: stats._sum.views || 0,
        totalConversions: stats._sum.conversions || 0,
        totalRevenue: stats._sum.revenue || 0,
        conversionRate: (stats._sum.conversions || 0) / (stats._sum.views || 1),
    };
}
