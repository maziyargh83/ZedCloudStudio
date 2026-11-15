import { z } from 'zod';

export const mediaTypeSchema = z.enum(['photo', 'video', 'audio']);
export const customMetadataSchema = z
  .record(z.string().trim().min(1).max(64), z.string().max(2000))
  .refine((value) => Object.keys(value).length <= 20, 'Use at most 20 custom fields');
export const assetSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  filename: z.string().min(1).max(255),
  type: mediaTypeSchema,
  mime: z.string().max(120),
  size: z.number().int().nonnegative(),
  source: z.enum(['local', 'demo', 'upload']),
  sourcePath: z.string().max(4096).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  capturedAt: z.iso.datetime(),
  tags: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  description: z.string().max(10000).default(''),
  favorite: z.boolean().default(false),
  location: z.string().max(300).default(''),
  collectionId: z.string().max(100).optional(),
  collectionName: z.string().max(100).optional(),
  customMetadata: customMetadataSchema.default({}),
  destinationId: z.string().max(100).optional(),
  objectKey: z.string().max(2048).optional(),
});
export const createAssetSchema = assetSchema.omit({ id: true });
export const updateAssetSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    tags: z.array(z.string().trim().min(1).max(64)).max(50).optional(),
    description: z.string().max(10000).optional(),
    favorite: z.boolean().optional(),
    location: z.string().max(300).optional(),
    collectionId: z.string().max(100).optional(),
    collectionName: z.string().max(100).optional(),
    customMetadata: customMetadataSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');
export type MediaAsset = z.infer<typeof assetSchema>;
export type CreateAsset = z.input<typeof createAssetSchema>;
export type AssetPatch = z.infer<typeof updateAssetSchema>;
export const extensionManifestSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  apiVersion: z.literal(1),
  description: z.string(),
  capabilities: z.array(
    z.enum(['media:read', 'media:write', 'journal:write', 'ai:generate', 'publish:youtube']),
  ),
});
export type ExtensionManifest = z.infer<typeof extensionManifestSchema>;
export const youtubeJobSchema = z.object({
  id: z.uuid(),
  assetId: z.uuid(),
  title: z.string().min(1).max(100),
  description: z.string().max(5000),
  privacy: z.enum(['private', 'unlisted', 'public']),
});

export const CHUNK_SIZE = 8 * 1024 * 1024;
export const serverInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  endpoint: z.url().refine((value) => {
    const url = new URL(value);
    return (
      ['https:', 'http:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  }, 'Use an HTTP(S) endpoint without embedded credentials'),
  region: z.string().trim().min(1).max(100).default('us-east-1'),
  bucket: z.string().trim().max(255).default(''),
  prefix: z
    .string()
    .max(200)
    .regex(/^[a-zA-Z0-9/_-]*$/)
    .default('zcloud/'),
  forcePathStyle: z.boolean().default(true),
  enabled: z.boolean().default(true),
});
export const serverCredentialsSchema = z.object({
  accessKeyId: z.string().min(1).max(256),
  secretAccessKey: z.string().min(1).max(512),
});
export const storageServerSchema = serverInputSchema.extend({
  id: z.string(),
  kind: z.enum(['local', 's3']),
  credentialsConfigured: z.boolean(),
  lastCheckedAt: z.iso.datetime().optional(),
  connectionStatus: z.enum(['unchecked', 'connected', 'error']).default('unchecked'),
  connectionMessage: z.string().optional(),
});
export type StorageServer = z.infer<typeof storageServerSchema>;
export type ServerInput = z.infer<typeof serverInputSchema>;
export const uploadMetadataSchema = createAssetSchema
  .pick({
    title: true,
    filename: true,
    type: true,
    mime: true,
    size: true,
    capturedAt: true,
    tags: true,
    description: true,
    favorite: true,
    location: true,
    collectionId: true,
    collectionName: true,
    customMetadata: true,
  })
  .extend({
    size: z
      .number()
      .int()
      .positive()
      .max(50 * 1024 ** 3),
  });
export type UploadMetadata = z.infer<typeof uploadMetadataSchema>;
export const createUploadSchema = z.object({
  id: z.uuid(),
  destinationId: z.string().min(1).max(100),
  metadata: uploadMetadataSchema,
});
export const transferStatusSchema = z.enum([
  'queued',
  'uploading',
  'paused',
  'failed',
  'completed',
  'cancelled',
]);
export type TransferStatus = z.infer<typeof transferStatusSchema>;
export const uploadSessionSchema = z.object({
  id: z.uuid(),
  destinationId: z.string(),
  destinationName: z.string(),
  metadata: uploadMetadataSchema,
  status: transferStatusSchema,
  phase: z.enum(['receiving', 'waiting', 'preparing', 'destination', 'registering', 'done']),
  receivedBytes: z.number(),
  destinationBytes: z.number(),
  chunks: z.array(z.object({ index: z.number().int(), size: z.number(), hash: z.string() })),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  generation: z.number().int(),
  error: z.string().optional(),
  target: serverInputSchema.optional(),
  objectKey: z.string().optional(),
  contentHash: z.string().optional(),
  remote: z
    .object({
      uploadId: z.string(),
      parts: z.array(z.object({ number: z.number(), etag: z.string(), size: z.number() })),
      completed: z.boolean().default(false),
    })
    .optional(),
});
export type UploadSession = z.infer<typeof uploadSessionSchema>;
export type PublicUploadSession = Omit<
  UploadSession,
  'target' | 'remote' | 'generation' | 'chunks'
> & { receivedChunks: number[]; chunkHashes: Record<string, string>; chunkSize: number };
export interface TransferJob {
  id: string;
  metadata: UploadMetadata;
  destinationId: string;
  destinationName: string;
  status: TransferStatus;
  phase: UploadSession['phase'];
  receivedBytes: number;
  destinationBytes: number;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}
