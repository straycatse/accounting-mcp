CREATE TABLE "tool_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"provider" text,
	"tenant_id" text,
	"tool_name" text NOT NULL,
	"mutating" boolean NOT NULL,
	"success" boolean NOT NULL,
	"duration_ms" integer NOT NULL,
	"error_code" text,
	"params" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
