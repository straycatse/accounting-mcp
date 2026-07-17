CREATE TABLE "accounting_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"tenant_id" text NOT NULL,
	"external_connection_id" text,
	"company_name" text,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"scopes" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounting_connection" ADD CONSTRAINT "accounting_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounting_connection_user_provider_tenant" ON "accounting_connection" USING btree ("user_id","provider","tenant_id");