CREATE TABLE "app"."insight" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"question" text NOT NULL,
	"tone" text NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"computed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."subscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dashboard_id" integer NOT NULL,
	"frequency" text NOT NULL,
	"hour" integer NOT NULL,
	"minute" integer DEFAULT 0 NOT NULL,
	"day_of_week" integer,
	"day_of_month" integer,
	"timezone" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"last_run_at" timestamp,
	"last_totals" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."subscription_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"sent_to" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subscription" ADD CONSTRAINT "subscription_dashboard_id_dashboard_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "app"."dashboard"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."subscription_run" ADD CONSTRAINT "subscription_run_subscription_id_subscription_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "app"."subscription"("id") ON DELETE cascade ON UPDATE no action;