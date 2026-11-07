CREATE TABLE "app"."invitation" (
	"token" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"access_role" text DEFAULT 'member' NOT NULL,
	"business_role" text DEFAULT 'sales' NOT NULL,
	"invited_by" text,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."user" ADD COLUMN "access_role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."invitation" ADD CONSTRAINT "invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "app"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Existing installs: the earliest user becomes the admin.
UPDATE "app"."user" SET "access_role" = 'admin' WHERE "id" = (SELECT "id" FROM "app"."user" ORDER BY "created_at" LIMIT 1);
