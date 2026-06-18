CREATE TABLE "handbook_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"section_path" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sensitivity" text DEFAULT 'safe' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "query_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"matched_section_id" integer,
	"retrieval_score" integer,
	"answered" boolean NOT NULL,
	"escalated" boolean NOT NULL,
	"sensitive" boolean NOT NULL,
	"answer_text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "query_log" ADD CONSTRAINT "query_log_matched_section_id_handbook_sections_id_fk" FOREIGN KEY ("matched_section_id") REFERENCES "public"."handbook_sections"("id") ON DELETE set null ON UPDATE no action;