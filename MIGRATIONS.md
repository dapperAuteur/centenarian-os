# CentenarianOS — Migrations Gallery

> **187 sequential migrations across 14 modules**, shipped solo since project inception. Schema lives in a Supabase Postgres database **shared with a sibling product** (Work.WitUS / contractor-os), so every migration has to be additive, RLS-aware, and cross-app-safe.

This doc is the visible evidence behind that headline. The full source is under [`supabase/migrations/`](./supabase/migrations/). Counts last refreshed 2026-04-30 from a live `ls supabase/migrations/*.sql | wc -l`.

---

## Why so many

Three constraints compound:

1. **Shared database.** centenarian-os and contractor-os both read/write the same Postgres instance. Every column, every index, every trigger has to make sense in the context of both apps. Bigger surface area + tighter coordination cost = more, smaller migrations.
2. **14 product modules in one app.** Planner, finance, focus, health metrics, wearables, workouts, exercises, equipment, travel, fuel, recipes, blog, academy/LMS, AI coach, plus auxiliary subsystems (media library, smart scan, retrospective, smart scan, life categories). Each module evolves independently.
3. **Additive-only as a rule.** [`CLAUDE.md`](./CLAUDE.md) §"Shared Database" mandates `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS` patterns. Drops and renames require cross-app review. The result: many small, safe migrations rather than a few sprawling ones.

---

## Module breakdown

Migration counts grouped by primary module. A handful of cross-cutting migrations (security fixes, polymorphic `activity_links`, life categories) touch many modules and are listed separately at the bottom.

### Academy / LMS (44 migrations)

The biggest module. Course catalog, lessons, modules, enrollments, quizzes, assignments, glossary, prerequisites, learning paths, audio/video chapters + transcripts, podcast links, virtual tours, 360° media, sequential locking, BVC seasons, course visibility flags.

Highlights: `039_lms_schema.sql` (the foundational schema), `045_learning_paths.sql`, `070_quiz_support.sql`, `071_audio_chapters.sql`, `074_maps_documents_podcast.sql`, `094_course_prerequisites.sql`, `175-179_lesson_360_*.sql + virtual_tours.sql + tour_progress.sql` (the 360°/VR run), `183_course_completions.sql`, `185_course_visibility_flags.sql` (admin-controlled featured + Learn-the-App grouping).

### Finance (15 migrations)

Multi-account ledger, custom budget categories, invoices with templates + custom fields, recurring transactions, transfers, interest calculations, FIFO fuel allocation, paycheck reconciliation, expected payments view, time-entry benefits, deductions, founders pricing, CashApp payments, fiscal calendar.

Highlights: `051_financial_dashboard.sql`, `054_financial_accounts.sql`, `058_invoices.sql`, `063_transfers_interest_recurring.sql`, `079_invoice_templates.sql`, `153_paycheck_line_items.sql`, `155_fiscal_calendar.sql`, `158_fifo_fuel_allocation.sql`, `168_paycheck_reconciliation.sql`.

### Travel + Fuel (13 migrations)

Trips with multi-stop routes, vehicle ownership/retirement, fuel logs with FIFO cost allocation, vehicle maintenance, trip templates, trip planning + budgets + sharing + sections, OSRM route columns, public transport library, public venues, city guides.

Highlights: `052_travel_schema.sql`, `053_travel_enhancements.sql`, `060_trip_templates_workouts.sql`, `065_multi_stop_routes.sql`, `116_osrm_route_columns.sql`, `121-125_trip_*.sql` (planning + budgets + sharing + media tracker), `129_public_transport_library.sql`, `158_fifo_fuel_allocation.sql`.

### Workouts + Exercises (11 migrations)

Exercise library with categories + form cues + media + equipment relationships, enhanced workout logging (RPE, tempo, supersets, unilateral, circuit, negative, isometric flags), workout feedback (mood/difficulty), suggestions, social interactions, system-seeded exercises, mode flags, difficulty levels.

Highlights: `082_exercise_library.sql`, `083_enhanced_workout_logging.sql` (16 + 19 new columns in one migration), `085_workout_feedback.sql`, `087_system_exercises.sql`, `088_exercise_equipment_needed.sql`, `091_exercise_mode_flags.sql`, `117_exercise_workout_social.sql`, `146_workout_suggestions.sql`.

### Planner / Tasks / Schedules (10 migrations)

Recurring tasks, schedule templates (work/fitness/class/custom with weekInterval), task source tracking, invoice → task sync trigger, pay-date → task sync trigger, fiscal calendar fixes, daily-log entity_type column.

Highlights: `021_recurring_tasks.sql`, `102_daily_log_entity_type.sql`, `147_task_source_tracking.sql`, `148_invoice_task_sync_trigger.sql`, `151_schedule_templates.sql` (the unified work/fitness/class/custom schedule system), `153_expected_payments_view.sql`, `154_pay_date_task_sync_trigger.sql`, `156-157_fix_trigger_target_year.sql` (year-rollover hot-fix pair).

### Health Metrics + Wearables (4 migrations)

3-tier health metric model (core / enrichment / body composition), wearable OAuth (Oura, WHOOP, Garmin), CSV imports (Apple Health, Google Health, InBody, Hume Health), per-source attribution, InBody body composition scans.

Highlights: `044_health_metrics.sql`, `050_wearables.sql`, `080_health_metrics_source.sql`, `145_inbody_scans.sql`.

### Recipes (6 migrations)

Recipes with ingredients + media + likes + saves + interaction events, recipe visibility simplification.

Highlights: `027_recipes.sql`, `028_recipe_ingredients.sql`, `029_recipe_media.sql`, `030_recipe_likes_saves.sql`, `031_recipe_events.sql`, `032_simplify_recipe_visibility.sql`.

### Blog (5 migrations)

Posts, view tracking, blocked-visit tracking, likes/saves, Facebook share metadata.

Highlights: `024_blog_posts.sql`, `025_blog_events.sql`, `026_blog_blocked_visit.sql`, `035_blog_likes_saves.sql`, `043_facebook_share.sql`.

### Focus / Sessions / Pomodoro / Engine (8 migrations)

Pomodoro sessions with tags, goals, breaks, templates, analytics, daily-log constraints, agility engine, leaderboard trigger fix, session_type column, focus-session activity links.

Highlights: `009_add_session_tags.sql` through `020_add_session_type.sql` (the foundational batch), `076_focus_session_activity_link.sql` (cross-module link), `017_agility_engine_migration.sql`.

### Equipment Tracker (3 migrations)

Equipment categories, valuations history, multi-media gallery (images/videos/audio per item).

Highlights: `069_equipment.sql`, `086_equipment_catalog.sql`, `119_equipment_media.sql`.

### Contacts (4 migrations)

Saved vendor/customer/location contacts, sub-locations per contact, contact website field, contacts system rebuild for cross-app.

Highlights: `056_user_contacts.sql`, `064_contact_locations_round_trips.sql`, `150_contacts_system.sql`, `152_contact_website.sql`.

### Media Library + Attachments (8 migrations)

Polymorphic media tracker (creators, platforms, relationships, notes), audio + image attachments, the academy media library (panorama_video, panorama_image, audio kinds), offline-asset registry.

Highlights: `125_media_tracker.sql`, `139_media_relationships.sql`, `140_media_notes_audio.sql`, `141_media_creators_platforms.sql`, `142_audio_attachments.sql`, `143_image_attachments.sql`, `180_media_assets.sql`, `181_offline_assets.sql`.

### Smart Scan / Receipt OCR (1 migration)

Universal OCR via Gemini Vision (receipts, recipes, fuel, maintenance, medical), per-item price tracking, fuzzy item matching.

Highlights: `093_smart_scan.sql` — single migration that adds `scan_images`, `receipt_line_items`, `item_prices`, `profiles.scan_auto_save_images`.

### AI Coach + Gems + Help RAG (5 migrations)

Help-content RAG embeddings, conversational AI coach, AI mode toggle, gem documents, admin chat threads, help-article app column.

Highlights: `042_help_rag.sql`, `038_conversations.sql`, `061_gem_ai_mode.sql`, `068_gem_documents.sql`, `104_admin_chats.sql`, `156_fix_match_help_articles.sql`.

### Cross-app contractor support (10 migrations)

The shared-DB story in concrete migration form. centenarian-os and contractor-os coordinate via shared tables; these migrations land here even though contractor-os reads them too.

Highlights: `105_contractor_jobs.sql`, `106_contractor_rate_cards.sql`, `107_job_replacement_requests.sql`, `109_union_contract_rag.sql`, `112_union_rag_submissions.sql`, `113_union_memberships.sql`, `114_admin_contractor_access.sql`, `128_job_document_categories.sql`, `134_union_doc_replacement.sql`, `149_job_notes_events_multiuser.sql`.

### Cross-cutting / utility (~30 migrations)

Things that don't belong to one module: `023_profiles.sql`, `036_auto_profile_on_signup.sql` (auth shape), `037_feature_batch.sql`, `040_visibility.sql` (academy + blog visibility model), `049_shortlinks.sql`, `066_activity_links.sql` (polymorphic cross-module relations across 11 entity types), `077_life_categories.sql` (user-defined life-area tagging across 11 entity types), `084_dashboard_home_preference.sql`, `089_admin_notifications.sql`, `090_invited_users.sql` + `090_security_fixes.sql`, `100_app_logs.sql`, `101_usage_events.sql`, `108_city_guides.sql`, `110_lister_system.sql`, `111_home_address_distance.sql`, `115_multi_product_invites.sql`, `118_module_onboarding.sql`, `120_add_clock_format.sql`, `127_push_notifications.sql`, `131_public_venues.sql`, `132_invite_limits_paid_tracking.sql`, `133_feedback_app_column.sql`, `135_benefit_deductions.sql`, `136_invite_job_limit.sql`, `137_seo_tracking.sql`, `138_seo_app_column.sql`, `159_enable_rls_security_fixes.sql`, `161-164_email_campaigns + marketing_banners + referral_rewards + notification_preferences.sql`, `166_theme_preference.sql`, `167_time_entry_benefits.sql`, `170_contact_share_visible_fields.sql`, `171-174_cashapp + founders + admin_promo + cashapp_app_column + dashboard_home_per_app.sql`, `182_starter_tier.sql`.

### Repair / non-sequential migrations (4)

Migrations that broke the strict numeric sequence — kept as historical artifacts: `20251021155203_remote_schema.sql` (timestamp-named export), `xxx-0_financial_tracking.sql`, `xxx-1-renumber-add-to-db_financial_tracking.sql`, `xxx-renumber-add-to-db_financial_tracking.sql`. The `xxx-` prefix marks renumbered drafts that needed manual reconciliation.

---

## Notable patterns

### Migrations that touched 10+ existing rows on day-one of deployment

- `083_enhanced_workout_logging.sql` — added 16 new columns to `workout_template_exercises` and 19 to `workout_log_exercises` (boolean flags for circuit / negative / isometric / to_failure / superset / balance / unilateral; numeric for superset_group / percent_of_max / rpe / distance_miles / hold_sec; text for tempo / phase; log-only side / feeling / rest_sec).
- `093_smart_scan.sql` — three new tables (`scan_images`, `receipt_line_items`, `item_prices`) and one boolean column on `profiles`.
- `151_schedule_templates.sql` — unified work/fitness/class/custom schedule system; introduced `weekInterval` recurrence, `schedule_exceptions` (skip/paid_off/unpaid_off/reschedule), `schedule_pay_periods` with estimated-vs-actual reconciliation.
- `185_course_visibility_flags.sql` — five new columns on `courses` (admin Featured + App-tutorial flags, teacher-profile featured flags, ordering ints) with three partial indexes.

### Polymorphic relations

Two systems carry user-defined associations across 11+ entity types each:

- `066_activity_links.sql` — bidirectional `source_type/source_id ↔ target_type/target_id` linking task ↔ trip ↔ route ↔ transaction ↔ recipe ↔ fuel_log ↔ maintenance ↔ invoice ↔ workout ↔ equipment ↔ focus_session.
- `077_life_categories.sql` — user-defined Health/Finance/Career/etc. tags via `entity_life_categories` junction with the same 11 entity types, plus 8 auto-seeded defaults per user.

### Database triggers

A handful of migrations add triggers that wire two modules together at the DB layer rather than at the app layer:

- `036_auto_profile_on_signup.sql` — `auth.users` insert → `profiles` row.
- `148_invoice_task_sync_trigger.sql` — `invoices` row insert → planner `tasks` row at due date.
- `154_pay_date_task_sync_trigger.sql` — paycheck pay-date → planner `tasks` row.

### Hot-fix pairs

When a migration shipped with a bug, the fix landed as the next sequential number rather than amending the original — keeps history honest:

- `017_agility_engine_migration.sql` → `018_fix_leaderboard_trigger.sql`
- `156_fix_match_help_articles.sql` + `156_fix_trigger_target_year.sql` → `157_fix_trigger_target_year.sql`

### Number collisions (intentional, two migrations per number)

Where two unrelated migrations were authored in the same numbering cycle but for different modules, both kept the same prefix:

- `054_coaching_applications.sql` + `054_financial_accounts.sql`
- `067_session_file_data.sql` + `067_vehicle_trip_mode.sql`
- `086_equipment_catalog.sql` + `086_page_views.sql`
- `090_invited_users.sql` + `090_security_fixes.sql`
- `150_contacts_system.sql` + `150_workout_feedback_difficulty_labels.sql`
- `153_expected_payments_view.sql` + `153_paycheck_line_items.sql`
- `156_fix_match_help_articles.sql` + `156_fix_trigger_target_year.sql`
- `174_cashapp_app_column.sql` + `174_dashboard_home_per_app.sql`

Supabase CLI applies them lexicographically, so this works as long as the two don't conflict. Worth tightening up if the project ever moves to strict-monotonic numbering, but no incidents have come from this pattern so far.

---

## Reproduce the count

```bash
# Total migrations (sequential + non-sequential):
ls supabase/migrations/*.sql | wc -l

# Per-module rough count (filename grep — imperfect but useful):
for module in academy finance travel workout fuel recipe blog focus equipment contact; do
  count=$(ls supabase/migrations/*.sql | grep -ic "$module")
  printf "%-12s %s\n" "$module" "$count"
done
```

Imperfect because some migrations don't carry the module name in the filename (e.g., the 360°/VR migrations are `175-179_lesson_360_*.sql` and `178_virtual_tours.sql`, not `academy_*`). The hand-curated breakdown above is more accurate.

---

## See also

- [`CLAUDE.md`](./CLAUDE.md) — project conventions, including the Shared Database rule that drives the additive-only migration discipline.
- [`STYLE_GUIDE.md`](./STYLE_GUIDE.md) — branch + commit + PR workflow.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the 14-module layout and the shared-DB boundary, with a Mermaid diagram.
- [`README.md`](./README.md) — top-level project intro.
