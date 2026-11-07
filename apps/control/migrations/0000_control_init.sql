CREATE SCHEMA IF NOT EXISTS "control";
--> statement-breakpoint
CREATE TABLE "control"."customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company" text NOT NULL,
	"email" text NOT NULL,
	"plan" text NOT NULL,
	"billing_interval" text,
	"status" text NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"install_url" text,
	"licence" text,
	"licence_issued_at" timestamp with time zone,
	"licence_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "customers_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "control"."stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
