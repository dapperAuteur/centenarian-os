


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "energy_rating" integer,
    "biggest_win" "text",
    "biggest_challenge" "text",
    "pain_intensity" integer,
    "pain_locations" "jsonb",
    "pain_sensations" "jsonb",
    "pain_activities" "jsonb",
    "pain_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "total_spent" numeric(10,2) DEFAULT 0,
    "total_earned" numeric(10,2) DEFAULT 0,
    CONSTRAINT "daily_logs_energy_rating_check" CHECK ((("energy_rating" >= 1) AND ("energy_rating" <= 5))),
    CONSTRAINT "daily_logs_pain_intensity_check" CHECK ((("pain_intensity" >= 1) AND ("pain_intensity" <= 10)))
);


ALTER TABLE "public"."daily_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."focus_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "task_id" "uuid",
    "start_time" timestamp with time zone NOT NULL,
    "end_time" timestamp with time zone,
    "duration" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "hourly_rate" numeric(10,2) DEFAULT 0,
    "revenue" numeric(10,2) DEFAULT 0
);


ALTER TABLE "public"."focus_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "roadmap_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text" NOT NULL,
    "target_year" integer NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "estimated_cost" numeric(10,2) DEFAULT 0,
    "actual_cost" numeric(10,2) DEFAULT 0,
    "revenue" numeric(10,2) DEFAULT 0,
    "archived_at" timestamp with time zone,
    CONSTRAINT "goals_category_check" CHECK (("category" = ANY (ARRAY['FITNESS'::"text", 'CREATIVE'::"text", 'SKILL'::"text", 'OUTREACH'::"text", 'LIFESTYLE'::"text", 'MINDSET'::"text", 'FUEL'::"text"]))),
    CONSTRAINT "goals_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'completed'::"text", 'deferred'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meal_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "protocol_id" "uuid",
    "meal_type" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "restaurant_name" "text",
    "restaurant_address" "text",
    "restaurant_city" "text",
    "restaurant_state" "text",
    "restaurant_country" "text",
    "restaurant_website" "text",
    "is_restaurant_meal" boolean DEFAULT false,
    CONSTRAINT "meal_logs_meal_type_check" CHECK (("meal_type" = ANY (ARRAY['breakfast'::"text", 'lunch'::"text", 'dinner'::"text", 'snack'::"text"])))
);


ALTER TABLE "public"."meal_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."milestones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "goal_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "target_date" "date" NOT NULL,
    "status" "text" DEFAULT 'not_started'::"text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "estimated_cost" numeric(10,2) DEFAULT 0,
    "actual_cost" numeric(10,2) DEFAULT 0,
    "revenue" numeric(10,2) DEFAULT 0,
    "archived_at" timestamp with time zone,
    CONSTRAINT "milestones_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'completed'::"text", 'blocked'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."milestones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protocols" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "ncv_score" "text" NOT NULL,
    "total_cost" numeric DEFAULT 0 NOT NULL,
    "total_calories" numeric DEFAULT 0 NOT NULL,
    "total_protein" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "prep_time_minutes" integer,
    "cook_time_minutes" integer,
    "servings" numeric,
    "date_made" "date",
    "date_finished" "date",
    CONSTRAINT "protocols_ncv_score_check" CHECK (("ncv_score" = ANY (ARRAY['Green'::"text", 'Yellow'::"text", 'Red'::"text"])))
);


ALTER TABLE "public"."protocols" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roadmaps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "estimated_cost" numeric(10,2) DEFAULT 0,
    "actual_cost" numeric(10,2) DEFAULT 0,
    "revenue" numeric(10,2) DEFAULT 0,
    "archived_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "roadmaps_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."roadmaps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "milestone_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "time" time without time zone NOT NULL,
    "activity" "text" NOT NULL,
    "description" "text",
    "tag" "text" NOT NULL,
    "priority" integer,
    "completed" boolean DEFAULT false,
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "estimated_cost" numeric(10,2) DEFAULT 0,
    "actual_cost" numeric(10,2) DEFAULT 0,
    "revenue" numeric(10,2) DEFAULT 0,
    "archived_at" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY[1, 2, 3]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."daily_aggregates" AS
 WITH "date_series" AS (
         SELECT ("generate_series"((CURRENT_DATE - '90 days'::interval), (CURRENT_DATE)::timestamp without time zone, '1 day'::interval))::"date" AS "date"
        )
 SELECT "date",
    "auth"."uid"() AS "user_id",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM ((("public"."tasks" "t"
             JOIN "public"."milestones" "m" ON (("m"."id" = "t"."milestone_id")))
             JOIN "public"."goals" "g" ON (("g"."id" = "m"."goal_id")))
             JOIN "public"."roadmaps" "r" ON (("r"."id" = "g"."roadmap_id")))
          WHERE (("t"."date" = "ds"."date") AND ("r"."user_id" = "auth"."uid"()) AND ("t"."completed" = true))), (0)::bigint) AS "tasks_completed",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM ((("public"."tasks" "t"
             JOIN "public"."milestones" "m" ON (("m"."id" = "t"."milestone_id")))
             JOIN "public"."goals" "g" ON (("g"."id" = "m"."goal_id")))
             JOIN "public"."roadmaps" "r" ON (("r"."id" = "g"."roadmap_id")))
          WHERE (("t"."date" = "ds"."date") AND ("r"."user_id" = "auth"."uid"()))), (0)::bigint) AS "tasks_total",
        CASE
            WHEN (COALESCE(( SELECT "count"(*) AS "count"
               FROM ((("public"."tasks" "t"
                 JOIN "public"."milestones" "m" ON (("m"."id" = "t"."milestone_id")))
                 JOIN "public"."goals" "g" ON (("g"."id" = "m"."goal_id")))
                 JOIN "public"."roadmaps" "r" ON (("r"."id" = "g"."roadmap_id")))
              WHERE (("t"."date" = "ds"."date") AND ("r"."user_id" = "auth"."uid"()))), (0)::bigint) = 0) THEN (0)::double precision
            ELSE (((COALESCE(( SELECT "count"(*) AS "count"
               FROM ((("public"."tasks" "t"
                 JOIN "public"."milestones" "m" ON (("m"."id" = "t"."milestone_id")))
                 JOIN "public"."goals" "g" ON (("g"."id" = "m"."goal_id")))
                 JOIN "public"."roadmaps" "r" ON (("r"."id" = "g"."roadmap_id")))
              WHERE (("t"."date" = "ds"."date") AND ("r"."user_id" = "auth"."uid"()) AND ("t"."completed" = true))), (0)::bigint))::double precision / (COALESCE(( SELECT "count"(*) AS "count"
               FROM ((("public"."tasks" "t"
                 JOIN "public"."milestones" "m" ON (("m"."id" = "t"."milestone_id")))
                 JOIN "public"."goals" "g" ON (("g"."id" = "m"."goal_id")))
                 JOIN "public"."roadmaps" "r" ON (("r"."id" = "g"."roadmap_id")))
              WHERE (("t"."date" = "ds"."date") AND ("r"."user_id" = "auth"."uid"()))), (1)::bigint))::double precision) * (100)::double precision)
        END AS "completion_rate",
    COALESCE(( SELECT "avg"(
                CASE
                    WHEN ("p"."ncv_score" = 'Green'::"text") THEN 3
                    WHEN ("p"."ncv_score" = 'Yellow'::"text") THEN 2
                    WHEN ("p"."ncv_score" = 'Red'::"text") THEN 1
                    ELSE 0
                END) AS "avg"
           FROM ("public"."meal_logs" "ml"
             JOIN "public"."protocols" "p" ON (("p"."id" = "ml"."protocol_id")))
          WHERE (("ml"."date" = "ds"."date") AND ("ml"."user_id" = "auth"."uid"()) AND ("ml"."is_restaurant_meal" = false))), (0)::numeric) AS "avg_ncv_numeric",
    COALESCE(( SELECT "p"."ncv_score"
           FROM ("public"."meal_logs" "ml"
             JOIN "public"."protocols" "p" ON (("p"."id" = "ml"."protocol_id")))
          WHERE (("ml"."date" = "ds"."date") AND ("ml"."user_id" = "auth"."uid"()) AND ("ml"."is_restaurant_meal" = false))
          GROUP BY "p"."ncv_score"
          ORDER BY ("count"(*)) DESC
         LIMIT 1), 'Unknown'::"text") AS "ncv_score_mode",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."meal_logs" "ml"
          WHERE (("ml"."date" = "ds"."date") AND ("ml"."user_id" = "auth"."uid"()))), (0)::bigint) AS "meal_count",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."meal_logs" "ml"
          WHERE (("ml"."date" = "ds"."date") AND ("ml"."user_id" = "auth"."uid"()) AND ("ml"."is_restaurant_meal" = true))), (0)::bigint) AS "restaurant_meal_count",
    COALESCE(( SELECT "sum"("p"."total_cost") AS "sum"
           FROM ("public"."meal_logs" "ml"
             JOIN "public"."protocols" "p" ON (("p"."id" = "ml"."protocol_id")))
          WHERE (("ml"."date" = "ds"."date") AND ("ml"."user_id" = "auth"."uid"()) AND ("ml"."is_restaurant_meal" = false))), (0)::numeric) AS "daily_food_cost",
    COALESCE(( SELECT (("sum"("fs"."duration"))::numeric / 60.0)
           FROM "public"."focus_sessions" "fs"
          WHERE ((("fs"."start_time")::"date" = "ds"."date") AND ("fs"."user_id" = "auth"."uid"()))), (0)::numeric) AS "focus_minutes",
    COALESCE(( SELECT "count"(*) AS "count"
           FROM "public"."focus_sessions" "fs"
          WHERE ((("fs"."start_time")::"date" = "ds"."date") AND ("fs"."user_id" = "auth"."uid"()))), (0)::bigint) AS "focus_session_count",
    COALESCE(( SELECT "dl"."pain_intensity"
           FROM "public"."daily_logs" "dl"
          WHERE (("dl"."date" = "ds"."date") AND ("dl"."user_id" = "auth"."uid"()))
         LIMIT 1), 0) AS "pain_score",
    COALESCE(( SELECT "dl"."energy_rating"
           FROM "public"."daily_logs" "dl"
          WHERE (("dl"."date" = "ds"."date") AND ("dl"."user_id" = "auth"."uid"()))
         LIMIT 1), 0) AS "energy_rating",
    EXTRACT(dow FROM "date") AS "day_of_week",
    EXTRACT(week FROM "date") AS "week_number"
   FROM "date_series" "ds"
  ORDER BY "date" DESC;


ALTER VIEW "public"."daily_aggregates" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."correlation_candidates" AS
 SELECT ( SELECT "avg"("daily_aggregates"."energy_rating") AS "avg"
           FROM "public"."daily_aggregates"
          WHERE (("daily_aggregates"."ncv_score_mode" = 'Green'::"text") AND ("daily_aggregates"."energy_rating" > 0))) AS "green_day_avg_energy",
    ( SELECT "avg"("daily_aggregates"."energy_rating") AS "avg"
           FROM "public"."daily_aggregates"
          WHERE (("daily_aggregates"."ncv_score_mode" <> 'Green'::"text") AND ("daily_aggregates"."energy_rating" > 0))) AS "non_green_day_avg_energy",
    ( SELECT "avg"("daily_aggregates"."completion_rate") AS "avg"
           FROM "public"."daily_aggregates"
          WHERE (("daily_aggregates"."focus_minutes" >= (180)::numeric) AND ("daily_aggregates"."tasks_total" > 0))) AS "high_focus_completion_rate",
    ( SELECT "avg"("daily_aggregates"."completion_rate") AS "avg"
           FROM "public"."daily_aggregates"
          WHERE (("daily_aggregates"."focus_minutes" < (180)::numeric) AND ("daily_aggregates"."tasks_total" > 0))) AS "low_focus_completion_rate",
    ( SELECT "avg"("daily_aggregates"."focus_minutes") AS "avg"
           FROM "public"."daily_aggregates"
          WHERE ("daily_aggregates"."pain_score" >= 4)) AS "high_pain_avg_focus",
    ( SELECT "avg"("daily_aggregates"."focus_minutes") AS "avg"
           FROM "public"."daily_aggregates"
          WHERE ("daily_aggregates"."pain_score" < 4)) AS "low_pain_avg_focus",
    ( SELECT "avg"("daily_aggregates"."completion_rate") AS "avg"
           FROM "public"."daily_aggregates"
          WHERE (("daily_aggregates"."restaurant_meal_count" = 0) AND ("daily_aggregates"."tasks_total" > 0))) AS "no_restaurant_completion_rate",
    ( SELECT "avg"("daily_aggregates"."completion_rate") AS "avg"
           FROM "public"."daily_aggregates"
          WHERE (("daily_aggregates"."restaurant_meal_count" > 0) AND ("daily_aggregates"."tasks_total" > 0))) AS "restaurant_day_completion_rate",
    ( SELECT "count"(*) AS "count"
           FROM "public"."daily_aggregates"
          WHERE ("daily_aggregates"."ncv_score_mode" = 'Green'::"text")) AS "green_day_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."daily_aggregates"
          WHERE ("daily_aggregates"."focus_minutes" >= (180)::numeric)) AS "high_focus_day_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."daily_aggregates"
          WHERE ("daily_aggregates"."pain_score" >= 4)) AS "high_pain_day_count",
    ( SELECT "count"(*) AS "count"
           FROM "public"."daily_aggregates"
          WHERE ("daily_aggregates"."restaurant_meal_count" > 0)) AS "restaurant_day_count";


ALTER VIEW "public"."correlation_candidates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "ncv_score" "text" NOT NULL,
    "calories_per_100g" numeric NOT NULL,
    "protein_per_100g" numeric NOT NULL,
    "carbs_per_100g" numeric NOT NULL,
    "fat_per_100g" numeric NOT NULL,
    "fiber_per_100g" numeric DEFAULT 0,
    "cost_per_unit" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "notes" "text",
    "usda_fdc_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "brand" "text",
    "store_name" "text",
    "store_website" "text",
    "vendor_notes" "text",
    CONSTRAINT "ingredients_ncv_score_check" CHECK (("ncv_score" = ANY (ARRAY['Green'::"text", 'Yellow'::"text", 'Red'::"text"]))),
    CONSTRAINT "ingredients_unit_check" CHECK (("unit" = ANY (ARRAY['g'::"text", 'ml'::"text", 'oz'::"text", 'lb'::"text", 'kg'::"text", 'cup'::"text", 'tbsp'::"text", 'tsp'::"text", 'whole'::"text"])))
);


ALTER TABLE "public"."ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "quantity" numeric DEFAULT 0 NOT NULL,
    "unit" "text" NOT NULL,
    "low_stock_threshold" numeric DEFAULT 0,
    "last_restocked" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."inventory" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meal_log_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meal_log_id" "uuid" NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meal_log_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meal_prep_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "protocol_id" "uuid" NOT NULL,
    "date_made" "date" NOT NULL,
    "date_finished" "date",
    "servings_made" numeric NOT NULL,
    "servings_remaining" numeric NOT NULL,
    "storage_location" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meal_prep_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."protocol_ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "protocol_id" "uuid" NOT NULL,
    "ingredient_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."protocol_ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "low_servings_threshold" integer DEFAULT 3,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_profiles_low_servings_threshold_check" CHECK (("low_servings_threshold" > 0))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."weekly_aggregates" AS
 SELECT "week_number",
    "min"("date") AS "week_start",
    "max"("date") AS "week_end",
    "sum"("tasks_completed") AS "tasks_completed",
    "sum"("tasks_total") AS "tasks_total",
    "avg"("completion_rate") AS "avg_completion_rate",
    "avg"("avg_ncv_numeric") AS "avg_ncv_score",
    "sum"("meal_count") AS "total_meals",
    "sum"("restaurant_meal_count") AS "total_restaurant_meals",
    "sum"("daily_food_cost") AS "total_food_cost",
    "sum"("focus_minutes") AS "total_focus_minutes",
    "avg"("focus_session_count") AS "avg_sessions_per_day",
    "avg"("pain_score") AS "avg_pain_score",
    "avg"("energy_rating") AS "avg_energy_rating",
    "count"(*) AS "days_in_week",
    "count"(
        CASE
            WHEN ("completion_rate" >= (90)::double precision) THEN 1
            ELSE NULL::integer
        END) AS "high_completion_days"
   FROM "public"."daily_aggregates"
  GROUP BY "week_number"
  ORDER BY "week_number" DESC;


ALTER VIEW "public"."weekly_aggregates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_user_id_ingredient_id_key" UNIQUE ("user_id", "ingredient_id");



ALTER TABLE ONLY "public"."meal_log_ingredients"
    ADD CONSTRAINT "meal_log_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meal_prep_batches"
    ADD CONSTRAINT "meal_prep_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protocol_ingredients"
    ADD CONSTRAINT "protocol_ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."protocols"
    ADD CONSTRAINT "protocols_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roadmaps"
    ADD CONSTRAINT "roadmaps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");



CREATE INDEX "idx_daily_logs_date" ON "public"."daily_logs" USING "btree" ("date");



CREATE INDEX "idx_daily_logs_date_user" ON "public"."daily_logs" USING "btree" ("date", "user_id");



CREATE INDEX "idx_daily_logs_financial" ON "public"."daily_logs" USING "btree" ("date", "total_spent", "total_earned");



CREATE INDEX "idx_daily_logs_user" ON "public"."daily_logs" USING "btree" ("user_id");



CREATE INDEX "idx_focus_sessions_start_user" ON "public"."focus_sessions" USING "btree" ("start_time", "user_id");



CREATE INDEX "idx_focus_sessions_task" ON "public"."focus_sessions" USING "btree" ("task_id");



CREATE INDEX "idx_focus_sessions_user" ON "public"."focus_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_goals_roadmap" ON "public"."goals" USING "btree" ("roadmap_id");



CREATE INDEX "idx_goals_status" ON "public"."goals" USING "btree" ("status");



CREATE INDEX "idx_ingredients_ncv" ON "public"."ingredients" USING "btree" ("ncv_score");



CREATE INDEX "idx_ingredients_user" ON "public"."ingredients" USING "btree" ("user_id");



CREATE INDEX "idx_inventory_user" ON "public"."inventory" USING "btree" ("user_id");



CREATE INDEX "idx_meal_logs_date_user" ON "public"."meal_logs" USING "btree" ("date", "user_id");



CREATE INDEX "idx_meal_logs_user_date" ON "public"."meal_logs" USING "btree" ("user_id", "date");



CREATE INDEX "idx_meal_prep_batches_date" ON "public"."meal_prep_batches" USING "btree" ("date_made");



CREATE INDEX "idx_meal_prep_batches_user" ON "public"."meal_prep_batches" USING "btree" ("user_id");



CREATE INDEX "idx_milestones_goal" ON "public"."milestones" USING "btree" ("goal_id");



CREATE INDEX "idx_milestones_status" ON "public"."milestones" USING "btree" ("status");



CREATE INDEX "idx_protocols_user" ON "public"."protocols" USING "btree" ("user_id");



CREATE INDEX "idx_roadmaps_status" ON "public"."roadmaps" USING "btree" ("status");



CREATE INDEX "idx_tasks_date" ON "public"."tasks" USING "btree" ("date");



CREATE INDEX "idx_tasks_financial" ON "public"."tasks" USING "btree" ("actual_cost", "revenue");



CREATE INDEX "idx_tasks_milestone" ON "public"."tasks" USING "btree" ("milestone_id");



CREATE INDEX "idx_tasks_status" ON "public"."tasks" USING "btree" ("status");



CREATE INDEX "idx_user_profiles_user" ON "public"."user_profiles" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "update_ingredients_updated_at" BEFORE UPDATE ON "public"."ingredients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_inventory_updated_at" BEFORE UPDATE ON "public"."inventory" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_meal_prep_batches_updated_at" BEFORE UPDATE ON "public"."meal_prep_batches" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_protocols_updated_at" BEFORE UPDATE ON "public"."protocols" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_user_profiles_updated_at" BEFORE UPDATE ON "public"."user_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."focus_sessions"
    ADD CONSTRAINT "focus_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."goals"
    ADD CONSTRAINT "goals_roadmap_id_fkey" FOREIGN KEY ("roadmap_id") REFERENCES "public"."roadmaps"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory"
    ADD CONSTRAINT "inventory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_log_ingredients"
    ADD CONSTRAINT "meal_log_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_log_ingredients"
    ADD CONSTRAINT "meal_log_ingredients_meal_log_id_fkey" FOREIGN KEY ("meal_log_id") REFERENCES "public"."meal_logs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."meal_logs"
    ADD CONSTRAINT "meal_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_prep_batches"
    ADD CONSTRAINT "meal_prep_batches_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meal_prep_batches"
    ADD CONSTRAINT "meal_prep_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."milestones"
    ADD CONSTRAINT "milestones_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."protocol_ingredients"
    ADD CONSTRAINT "protocol_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."protocol_ingredients"
    ADD CONSTRAINT "protocol_ingredients_protocol_id_fkey" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocols"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."protocols"
    ADD CONSTRAINT "protocols_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."roadmaps"
    ADD CONSTRAINT "roadmaps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_milestone_id_fkey" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can CRUD their daily logs" ON "public"."daily_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD their focus sessions" ON "public"."focus_sessions" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD their goals" ON "public"."goals" USING ((EXISTS ( SELECT 1
   FROM "public"."roadmaps"
  WHERE (("roadmaps"."id" = "goals"."roadmap_id") AND ("roadmaps"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can CRUD their ingredients" ON "public"."ingredients" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD their inventory" ON "public"."inventory" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD their meal log ingredients" ON "public"."meal_log_ingredients" USING ((EXISTS ( SELECT 1
   FROM "public"."meal_logs"
  WHERE (("meal_logs"."id" = "meal_log_ingredients"."meal_log_id") AND ("meal_logs"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can CRUD their meal logs" ON "public"."meal_logs" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD their meal prep batches" ON "public"."meal_prep_batches" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD their milestones" ON "public"."milestones" USING ((EXISTS ( SELECT 1
   FROM ("public"."goals"
     JOIN "public"."roadmaps" ON (("roadmaps"."id" = "goals"."roadmap_id")))
  WHERE (("goals"."id" = "milestones"."goal_id") AND ("roadmaps"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can CRUD their protocol ingredients" ON "public"."protocol_ingredients" USING ((EXISTS ( SELECT 1
   FROM "public"."protocols"
  WHERE (("protocols"."id" = "protocol_ingredients"."protocol_id") AND ("protocols"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can CRUD their protocols" ON "public"."protocols" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD their roadmaps" ON "public"."roadmaps" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can CRUD their tasks" ON "public"."tasks" USING ((EXISTS ( SELECT 1
   FROM (("public"."milestones"
     JOIN "public"."goals" ON (("goals"."id" = "milestones"."goal_id")))
     JOIN "public"."roadmaps" ON (("roadmaps"."id" = "goals"."roadmap_id")))
  WHERE (("milestones"."id" = "tasks"."milestone_id") AND ("roadmaps"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own profile" ON "public"."user_profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."user_profiles" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."user_profiles" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."daily_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."focus_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."goals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."inventory" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meal_log_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meal_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meal_prep_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."milestones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."protocol_ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."protocols" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roadmaps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";
























GRANT ALL ON TABLE "public"."daily_logs" TO "anon";
GRANT ALL ON TABLE "public"."daily_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_logs" TO "service_role";



GRANT ALL ON TABLE "public"."focus_sessions" TO "anon";
GRANT ALL ON TABLE "public"."focus_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."focus_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."goals" TO "anon";
GRANT ALL ON TABLE "public"."goals" TO "authenticated";
GRANT ALL ON TABLE "public"."goals" TO "service_role";



GRANT ALL ON TABLE "public"."meal_logs" TO "anon";
GRANT ALL ON TABLE "public"."meal_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_logs" TO "service_role";



GRANT ALL ON TABLE "public"."milestones" TO "anon";
GRANT ALL ON TABLE "public"."milestones" TO "authenticated";
GRANT ALL ON TABLE "public"."milestones" TO "service_role";



GRANT ALL ON TABLE "public"."protocols" TO "anon";
GRANT ALL ON TABLE "public"."protocols" TO "authenticated";
GRANT ALL ON TABLE "public"."protocols" TO "service_role";



GRANT ALL ON TABLE "public"."roadmaps" TO "anon";
GRANT ALL ON TABLE "public"."roadmaps" TO "authenticated";
GRANT ALL ON TABLE "public"."roadmaps" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."daily_aggregates" TO "anon";
GRANT ALL ON TABLE "public"."daily_aggregates" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_aggregates" TO "service_role";



GRANT ALL ON TABLE "public"."correlation_candidates" TO "anon";
GRANT ALL ON TABLE "public"."correlation_candidates" TO "authenticated";
GRANT ALL ON TABLE "public"."correlation_candidates" TO "service_role";



GRANT ALL ON TABLE "public"."ingredients" TO "anon";
GRANT ALL ON TABLE "public"."ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."inventory" TO "anon";
GRANT ALL ON TABLE "public"."inventory" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory" TO "service_role";



GRANT ALL ON TABLE "public"."meal_log_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."meal_log_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_log_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."meal_prep_batches" TO "anon";
GRANT ALL ON TABLE "public"."meal_prep_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."meal_prep_batches" TO "service_role";



GRANT ALL ON TABLE "public"."protocol_ingredients" TO "anon";
GRANT ALL ON TABLE "public"."protocol_ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."protocol_ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."weekly_aggregates" TO "anon";
GRANT ALL ON TABLE "public"."weekly_aggregates" TO "authenticated";
GRANT ALL ON TABLE "public"."weekly_aggregates" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;

