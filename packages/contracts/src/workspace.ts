import { z } from 'zod';
import { mediaInsightSchema, proposalSchema, assistantChatSchema } from './assistant';

export const reviewFieldSchema = z.enum(['title', 'description', 'tags', 'location', 'capturedAt']);
export type ReviewField = z.infer<typeof reviewFieldSchema>;
export const reviewAnswersSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(10000).optional(),
    tags: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
    location: z.string().trim().max(300).optional(),
    capturedAt: z.iso.datetime().optional(),
  })
  .strict();
export const reviewQuestionSchema = z.object({
  field: reviewFieldSchema,
  question: z.string().min(1).max(500),
  hint: z.string().max(500).default(''),
});
export const reviewRecordSchema = z.object({
  assetId: z.uuid(),
  revision: z.number().int().nonnegative(),
  fingerprint: z.string(),
  questions: z.array(reviewQuestionSchema).max(5),
  answers: reviewAnswersSchema,
  skipped: z.array(reviewFieldSchema).max(5),
  status: z.enum(['open', 'draft', 'complete', 'later']),
  questionSource: z.enum(['rules', 'liara', 'mixed']).default('rules'),
  updatedAt: z.iso.datetime(),
});
export type ReviewRecord = z.infer<typeof reviewRecordSchema>;
export const pointSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  time: z.iso.datetime().optional(),
  elevation: z.number().finite().min(-12000).max(10000).optional(),
  segment: z.number().int().nonnegative().default(0),
});
export type GeoPoint = z.infer<typeof pointSchema>;
export const gpxTimestampSchema = z.iso.datetime({ offset: true });
export const trackSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  kind: z.enum(['recorded', 'planned']),
  points: z.array(pointSchema).min(1).max(20000),
});
export type TripTrack = z.infer<typeof trackSchema>;
export const logSchema = z
  .object({
    id: z.uuid(),
    date: z.iso.date(),
    title: z.string().trim().min(1).max(200),
    body: z.string().max(10000).default(''),
    kind: z.enum(['journal', 'challenge', 'lesson', 'plan']),
    done: z.boolean().default(false),
    lat: z.number().finite().min(-90).max(90).optional(),
    lng: z.number().finite().min(-180).max(180).optional(),
  })
  .refine(
    (v) => (v.lat === undefined) === (v.lng === undefined),
    'Enter both latitude and longitude',
  );
export const gearSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(999),
  grams: z.number().nonnegative().max(100000).default(0),
  packed: z.boolean().default(false),
  notes: z.string().max(1000).default(''),
});
export const tripDataSchema = z.object({
  title: z.string().trim().min(1).max(200),
  destination: z.string().max(300).default(''),
  startDate: z.union([z.iso.date(), z.literal('')]).default(''),
  endDate: z.union([z.iso.date(), z.literal('')]).default(''),
  summary: z.string().max(10000).default(''),
  status: z.enum(['planning', 'active', 'finished']).default('planning'),
  mediaIds: z.array(z.uuid()).max(1000).default([]),
  logs: z.array(logSchema).max(2000).default([]),
  gear: z.array(gearSchema).max(500).default([]),
  tracks: z.array(trackSchema).max(50).default([]),
  story: z
    .object({
      text: z.string().max(30000),
      generatedAt: z.iso.datetime(),
      sourceRevision: z.number().int(),
    })
    .optional(),
  archived: z.boolean().default(false),
});
export const tripSchema = tripDataSchema.extend({
  id: z.uuid(),
  revision: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Trip = z.infer<typeof tripSchema>;
export const tripPatchSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    patch: z
      .object({
        title: tripDataSchema.shape.title,
        destination: tripDataSchema.shape.destination.removeDefault(),
        startDate: tripDataSchema.shape.startDate.removeDefault(),
        endDate: tripDataSchema.shape.endDate.removeDefault(),
        summary: tripDataSchema.shape.summary.removeDefault(),
        status: tripDataSchema.shape.status.removeDefault(),
        mediaIds: tripDataSchema.shape.mediaIds.removeDefault(),
        logs: tripDataSchema.shape.logs.removeDefault(),
        gear: tripDataSchema.shape.gear.removeDefault(),
        tracks: tripDataSchema.shape.tracks.removeDefault(),
        story: tripDataSchema.shape.story,
        archived: tripDataSchema.shape.archived.removeDefault(),
      })
      .partial()
      .strict()
      .refine((p) => Object.keys(p).length > 0, 'Supply a trip change'),
  })
  .strict();
export const workspaceSchema = z.object({
  version: z.literal(1),
  trips: z.array(tripSchema),
  reviews: z.array(reviewRecordSchema),
  insights:z.array(mediaInsightSchema).default([]),
  proposals:z.array(proposalSchema).default([]),
  chats:z.array(assistantChatSchema).default([]),
});
export type WorkspaceData = z.infer<typeof workspaceSchema>;
