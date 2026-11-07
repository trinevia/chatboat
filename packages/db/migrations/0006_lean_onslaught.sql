CREATE TABLE "app"."data_source" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"secret" text,
	"allowed_tables" text[] DEFAULT '{}' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"suggestions" text[] DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "data_source_one_active" ON "app"."data_source" USING btree ("is_active") WHERE "app"."data_source"."is_active";--> statement-breakpoint
INSERT INTO "app"."data_source" ("name", "kind", "is_active") VALUES ('Sample sales data', 'sample', true);
