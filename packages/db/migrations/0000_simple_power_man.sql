CREATE TYPE "public"."media_type" AS ENUM('photo', 'video', 'audio');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(200) NOT NULL,
	"filename" varchar(255) NOT NULL,
	"type" "media_type" NOT NULL,
	"mime" varchar(120) NOT NULL,
	"size" bigint NOT NULL,
	"source" varchar(16) NOT NULL,
	"source_path" text,
	"width" bigint,
	"height" bigint,
	"captured_at" timestamp with time zone NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
