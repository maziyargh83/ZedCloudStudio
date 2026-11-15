ALTER TABLE "assets" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "collection_id" varchar(100);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "collection_name" varchar(100);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "custom_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "destination_id" varchar(100);--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "object_key" text;