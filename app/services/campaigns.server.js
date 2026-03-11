/**
 * Campaign Service
 * Handles campaign CRUD operations
 */
import { prisma } from "~/db.server";
/**
 * Get all campaigns for a shop
 */
export async function getCampaigns(shopId) {
    return prisma.campaign.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
    });
}
/**
 * Get a single campaign
 */
export async function getCampaign(campaignId) {
    return prisma.campaign.findUnique({
        where: { id: campaignId },
    });
}
/**
 * Create a new campaign
 */
export async function createCampaign(input) {
    return prisma.campaign.create({
        data: {
            shopId: input.shopId,
            name: input.name,
            triggerType: input.triggerType,
            selectionMethod: input.selectionMethod,
            products: input.products ? JSON.stringify(input.products) : null,
            requiredTags: input.requiredTags ? JSON.stringify(input.requiredTags) : null,
            tagLogic: input.tagLogic,
            heading: input.heading,
            description: input.description,
            buttonText: input.buttonText,
        },
    });
}
/**
 * Update a campaign
 */
export async function updateCampaign(campaignId, data) {
    const updateData = {};
    if (data.name)
        updateData.name = data.name;
    if (data.triggerType)
        updateData.triggerType = data.triggerType;
    if (data.selectionMethod)
        updateData.selectionMethod = data.selectionMethod;
    if (data.products)
        updateData.products = JSON.stringify(data.products);
    if (data.requiredTags)
        updateData.requiredTags = JSON.stringify(data.requiredTags);
    if (data.tagLogic)
        updateData.tagLogic = data.tagLogic;
    if (data.heading)
        updateData.heading = data.heading;
    if (data.description)
        updateData.description = data.description;
    if (data.buttonText)
        updateData.buttonText = data.buttonText;
    return prisma.campaign.update({
        where: { id: campaignId },
        data: updateData,
    });
}
/**
 * Delete a campaign
 */
export async function deleteCampaign(campaignId) {
    return prisma.campaign.delete({
        where: { id: campaignId },
    });
}
/**
 * Toggle campaign on/off
 */
export async function toggleCampaign(campaignId, enabled) {
    return prisma.campaign.update({
        where: { id: campaignId },
        data: { enabled },
    });
}
