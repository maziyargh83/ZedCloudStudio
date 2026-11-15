import { z } from 'zod';
export const mediaInsightSchema=z.object({assetId:z.uuid(),checkedAt:z.iso.datetime(),status:z.enum(['read','no-metadata','unsupported','unavailable']),captureDate:z.iso.date().optional(),camera:z.string().max(200).optional(),lat:z.number().min(-90).max(90).optional(),lng:z.number().min(-180).max(180).optional(),locationSource:z.enum(['exif','user']).optional(),label:z.string().max(300).optional()});
export type MediaInsight=z.infer<typeof mediaInsightSchema>;
export const placeSchema=z.object({lat:z.number().finite().min(-90).max(90),lng:z.number().finite().min(-180).max(180),label:z.string().trim().min(1).max(300)});
export const journeyChangeSchema=z.object({
 intent:z.enum(['record','plan']).default('record'),
 tripId:z.uuid().optional(),tripRevision:z.number().int().nonnegative().optional(),
 title:z.string().trim().min(1).max(200),destination:z.string().max(300).default(''),
 startDate:z.union([z.iso.date(),z.literal('')]).default(''),endDate:z.union([z.iso.date(),z.literal('')]).default(''),
 mediaIds:z.array(z.uuid()).max(50).default([]),place:placeSchema.optional(),
 note:z.string().max(4000).default(''),
}).strict();
export type JourneyChange=z.infer<typeof journeyChangeSchema>;
export const proposalSchema=z.object({id:z.uuid(),chatId:z.uuid().optional(),createdAt:z.iso.datetime(),status:z.enum(['pending','applied','dismissed']),change:journeyChangeSchema,resultTripId:z.uuid().optional()});
export type JourneyProposal=z.infer<typeof proposalSchema>;
export const assistantToolSchema=z.object({name:z.string(),status:z.enum(['running','complete','error']),summary:z.string().max(2000),output:z.unknown().optional()});
export const assistantMessageSchema=z.object({id:z.uuid(),role:z.enum(['user','assistant']),text:z.string().max(30000),createdAt:z.iso.datetime(),status:z.enum(['complete','running','cancelled','error']),tools:z.array(assistantToolSchema).max(20).default([]),provider:z.enum(['liara','codex','claude']).optional()});
export const assistantChatSchema=z.object({id:z.uuid(),title:z.string().max(200),messages:z.array(assistantMessageSchema).max(200),updatedAt:z.iso.datetime()});
export type AssistantChat=z.infer<typeof assistantChatSchema>;
export type AssistantMessage=z.infer<typeof assistantMessageSchema>;
export const assistantTurnSchema=z.object({chatId:z.uuid(),text:z.string().trim().min(1).max(6000),provider:z.enum(['liara','codex','claude']),mediaId:z.uuid().optional(),tripId:z.uuid().optional()}).strict();
export const workspaceToolSchemas={
 workspace_overview:z.object({}).strict(),
 media_find:z.object({query:z.string().max(200).default('')}).strict(),
 media_inspect:z.object({id:z.uuid()}).strict(),
 trip_list:z.object({}).strict(),
 trip_get:z.object({id:z.uuid()}).strict(),
 place_search:z.object({query:z.string().trim().min(2).max(200)}).strict(),
 journey_propose:z.object({change:journeyChangeSchema}).strict(),
};
