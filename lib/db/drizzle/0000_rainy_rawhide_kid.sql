CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"username" text NOT NULL,
	"brand_name" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'barber' NOT NULL,
	"mode" text DEFAULT 'solo' NOT NULL,
	"lang" text DEFAULT 'uz' NOT NULL,
	"phone" text,
	"telegram_verified" boolean DEFAULT false NOT NULL,
	"telegram_id" text,
	"telegram_username" text,
	"working_hours_start" text,
	"working_hours_end" text,
	"bio" text,
	"avatar_url" text,
	"specializations" text,
	"schedule_json" text,
	"lunch_break_enabled" boolean DEFAULT false NOT NULL,
	"lunch_break_start" text,
	"lunch_break_end" text,
	"address" text,
	"map_link" text,
	"instagram" text,
	"gallery_images" text,
	"notif_new_booking" boolean DEFAULT true NOT NULL,
	"notif_cancellation" boolean DEFAULT true NOT NULL,
	"notif_reminders" boolean DEFAULT true NOT NULL,
	"notif_reminder_minutes" text DEFAULT '30' NOT NULL,
	"slug_changed_at" timestamp with time zone,
	"slug_change_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"telegram_id" text,
	"notes" text,
	"status" text DEFAULT 'new' NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(10, 2) DEFAULT '0' NOT NULL,
	"last_visit" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ru" text,
	"duration" integer DEFAULT 30 NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barber_id" uuid NOT NULL,
	"client_id" uuid,
	"client_name" text NOT NULL,
	"service_id" uuid,
	"service_name" text,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"booking_time" timestamp with time zone,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "booking_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"barber_id" text NOT NULL,
	"booking_data" text NOT NULL,
	"client_telegram_id" text,
	"client_name" text,
	"client_telegram_username" text,
	"booking_id" text,
	"client_phone" text,
	"notification_sent" boolean DEFAULT false NOT NULL,
	"cancel_notification_sent" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"old_slug" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_barber_id_users_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_barber_id_users_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_id_users_id_fk" FOREIGN KEY ("barber_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slug_redirects" ADD CONSTRAINT "slug_redirects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_phone_idx" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_telegram_id_idx" ON "users" USING btree ("telegram_id");--> statement-breakpoint
CREATE INDEX "services_barber_id_idx" ON "services" USING btree ("barber_id");--> statement-breakpoint
CREATE INDEX "bookings_barber_id_idx" ON "bookings" USING btree ("barber_id");--> statement-breakpoint
CREATE INDEX "bookings_client_id_idx" ON "bookings" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bookings_booking_time_idx" ON "bookings" USING btree ("booking_time");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_sessions_status_idx" ON "booking_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "booking_sessions_barber_id_idx" ON "booking_sessions" USING btree ("barber_id");--> statement-breakpoint
CREATE INDEX "booking_sessions_expires_idx" ON "booking_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "slug_redirects_old_slug_idx" ON "slug_redirects" USING btree ("old_slug");--> statement-breakpoint
CREATE INDEX "slug_redirects_user_id_idx" ON "slug_redirects" USING btree ("user_id");