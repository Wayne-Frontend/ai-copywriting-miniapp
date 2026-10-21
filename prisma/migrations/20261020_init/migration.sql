-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "wechat_openid" VARCHAR(128) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "document_type" VARCHAR(32) NOT NULL,
    "document_version" VARCHAR(32) NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,
    "source" VARCHAR(32) NOT NULL,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "username" VARCHAR(80) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "mfa_secret_ciphertext" TEXT NOT NULL,
    "role" VARCHAR(24) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "current_version_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "form_schema" JSONB NOT NULL,
    "output_schema" JSONB NOT NULL,
    "system_prompt_version" VARCHAR(40) NOT NULL,
    "developer_prompt" TEXT NOT NULL,
    "model_config" JSONB NOT NULL,
    "change_log" TEXT NOT NULL,
    "published_by" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "price_fen" BIGINT NOT NULL,
    "credits" INTEGER NOT NULL,
    "valid_days" INTEGER,
    "status" VARCHAR(16) NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "client_request_id" VARCHAR(80) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "merchant_order_no" VARCHAR(64) NOT NULL,
    "plan_name_snapshot" VARCHAR(80) NOT NULL,
    "price_fen" BIGINT NOT NULL,
    "credits_snapshot" INTEGER NOT NULL,
    "valid_days_snapshot" INTEGER,
    "status" VARCHAR(16) NOT NULL,
    "wechat_transaction_id" VARCHAR(64),
    "paid_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_request_id" VARCHAR(80) NOT NULL,
    "merchant_refund_no" VARCHAR(64) NOT NULL,
    "wechat_refund_id" VARCHAR(64),
    "amount_fen" BIGINT NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "review_note" VARCHAR(500),
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(16) NOT NULL,
    "provider_event_id" VARCHAR(80) NOT NULL,
    "event_type" VARCHAR(32) NOT NULL,
    "order_id" UUID,
    "refund_id" UUID,
    "transaction_ref" VARCHAR(80) NOT NULL,
    "payload_sha256" CHAR(64) NOT NULL,
    "verified_payload" JSONB NOT NULL,
    "processing_status" VARCHAR(16) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "processed_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(500),

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_jobs" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "template_version_id" UUID NOT NULL,
    "client_request_id" VARCHAR(80) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "input_data" JSONB NOT NULL,
    "result_data" JSONB,
    "schema_version" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "quota_day" DATE NOT NULL,
    "processing_token" UUID,
    "lease_until" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL,
    "deadline_at" TIMESTAMPTZ(6) NOT NULL,
    "preview_text" VARCHAR(240),
    "error_code" VARCHAR(64),
    "deleted_at" TIMESTAMPTZ(6),
    "content_purged_at" TIMESTAMPTZ(6),
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generation_attempts" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "model_name" VARCHAR(80) NOT NULL,
    "provider_request_id" VARCHAR(160),
    "status" VARCHAR(16) NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "duration_ms" INTEGER,
    "error_code" VARCHAR(64),
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "generation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_contents" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "generation_job_id" UUID NOT NULL,
    "edited_result" JSONB,
    "edited_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "saved_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_batches" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "source_type" VARCHAR(24) NOT NULL,
    "source_ref" VARCHAR(120) NOT NULL,
    "granted_qty" INTEGER NOT NULL,
    "reserved_qty" INTEGER NOT NULL,
    "consumed_qty" INTEGER NOT NULL,
    "held_qty" INTEGER NOT NULL,
    "revoked_qty" INTEGER NOT NULL,
    "expired_qty" INTEGER NOT NULL,
    "effective_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "credit_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_reservations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "generation_job_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "reserved_at" TIMESTAMPTZ(6) NOT NULL,
    "settled_at" TIMESTAMPTZ(6),

    CONSTRAINT "credit_reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_reservation_allocations" (
    "id" UUID NOT NULL,
    "reservation_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "credit_reservation_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "reservation_id" UUID,
    "order_id" UUID,
    "refund_id" UUID,
    "event_key" VARCHAR(180) NOT NULL,
    "event_type" VARCHAR(24) NOT NULL,
    "delta_granted" INTEGER NOT NULL,
    "delta_reserved" INTEGER NOT NULL,
    "delta_consumed" INTEGER NOT NULL,
    "delta_held" INTEGER NOT NULL,
    "delta_revoked" INTEGER NOT NULL,
    "delta_expired" INTEGER NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_daily_usage" (
    "user_id" UUID NOT NULL,
    "biz_date" DATE NOT NULL,
    "success_count" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_daily_usage_pkey" PRIMARY KEY ("user_id","biz_date")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "event_key" VARCHAR(180) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "available_at" TIMESTAMPTZ(6) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(80) NOT NULL,
    "resource_id" VARCHAR(120) NOT NULL,
    "request_id" VARCHAR(100) NOT NULL,
    "ip_hash" CHAR(64) NOT NULL,
    "change_summary" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wechat_openid_key" ON "users"("wechat_openid");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_token_hash_key" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_consents_user_id_document_type_document_version_key" ON "user_consents"("user_id", "document_type", "document_version");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_username_key" ON "admin_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "templates_code_key" ON "templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "templates_current_version_id_key" ON "templates"("current_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_template_id_version_key" ON "template_versions"("template_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "plans_code_key" ON "plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_merchant_order_no_key" ON "orders"("merchant_order_no");

-- CreateIndex
CREATE UNIQUE INDEX "orders_wechat_transaction_id_key" ON "orders"("wechat_transaction_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_id_idx" ON "orders"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "orders_user_id_client_request_id_key" ON "orders"("user_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_merchant_refund_no_key" ON "refunds"("merchant_refund_no");

-- CreateIndex
CREATE INDEX "refunds_order_id_idx" ON "refunds"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_user_id_client_request_id_key" ON "refunds"("user_id", "client_request_id");

-- CreateIndex
CREATE INDEX "payment_events_processing_status_received_at_idx" ON "payment_events"("processing_status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_provider_event_id_key" ON "payment_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "generation_jobs_user_id_created_at_id_idx" ON "generation_jobs"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "generation_jobs_user_id_client_request_id_key" ON "generation_jobs"("user_id", "client_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "generation_attempts_job_id_attempt_no_key" ON "generation_attempts"("job_id", "attempt_no");

-- CreateIndex
CREATE UNIQUE INDEX "saved_contents_generation_job_id_key" ON "saved_contents"("generation_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_batches_order_id_key" ON "credit_batches"("order_id");

-- CreateIndex
CREATE INDEX "credit_batches_user_id_expires_at_created_at_idx" ON "credit_batches"("user_id", "expires_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "credit_batches_user_id_source_type_source_ref_key" ON "credit_batches"("user_id", "source_type", "source_ref");

-- CreateIndex
CREATE UNIQUE INDEX "credit_reservations_generation_job_id_key" ON "credit_reservations"("generation_job_id");

-- CreateIndex
CREATE INDEX "credit_reservation_allocations_batch_id_idx" ON "credit_reservation_allocations"("batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_reservation_allocations_reservation_id_batch_id_key" ON "credit_reservation_allocations"("reservation_id", "batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_event_key_key" ON "credit_ledger"("event_key");

-- CreateIndex
CREATE INDEX "credit_ledger_user_id_created_at_id_idx" ON "credit_ledger"("user_id", "created_at" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_event_key_key" ON "outbox_events"("event_key");

-- CreateIndex
CREATE INDEX "outbox_events_status_available_at_created_at_idx" ON "outbox_events"("status", "available_at", "created_at");

-- CreateIndex
CREATE INDEX "admin_audit_logs_admin_user_id_created_at_idx" ON "admin_audit_logs"("admin_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generation_attempts" ADD CONSTRAINT "generation_attempts_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "generation_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_contents" ADD CONSTRAINT "saved_contents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_contents" ADD CONSTRAINT "saved_contents_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "generation_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_batches" ADD CONSTRAINT "credit_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_batches" ADD CONSTRAINT "credit_batches_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_generation_job_id_fkey" FOREIGN KEY ("generation_job_id") REFERENCES "generation_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_reservation_allocations" ADD CONSTRAINT "credit_reservation_allocations_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "credit_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_reservation_allocations" ADD CONSTRAINT "credit_reservation_allocations_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "credit_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "credit_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "credit_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_daily_usage" ADD CONSTRAINT "user_daily_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 同一用户只能有一个排队或执行中的生成任务；普通复合唯一索引无法表达此条件。
CREATE UNIQUE INDEX "uq_generation_active_user"
ON "generation_jobs"("user_id")
WHERE "status" IN ('queued', 'running');

-- 状态值和额度数量的边界由数据库兜底，状态迁移顺序仍由服务端事务控制。
ALTER TABLE "users" ADD CONSTRAINT "users_status_check"
CHECK ("status" IN ('active', 'disabled', 'deleting', 'deleted'));

ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_status_check"
CHECK ("status" IN ('queued', 'running', 'succeeded', 'rejected', 'failed', 'timed_out'));

ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_status_check"
CHECK ("status" IN ('reserved', 'consumed', 'released'));

ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_quantity_check"
CHECK ("quantity" = 1);

ALTER TABLE "credit_reservation_allocations" ADD CONSTRAINT "credit_reservation_allocations_quantity_check"
CHECK ("quantity" > 0);

ALTER TABLE "credit_batches" ADD CONSTRAINT "credit_batches_quantity_check"
CHECK (
    "granted_qty" >= 0 AND "reserved_qty" >= 0 AND "consumed_qty" >= 0
    AND "held_qty" >= 0 AND "revoked_qty" >= 0 AND "expired_qty" >= 0
    AND "reserved_qty"::BIGINT + "consumed_qty"::BIGINT + "held_qty"::BIGINT
        + "revoked_qty"::BIGINT + "expired_qty"::BIGINT <= "granted_qty"::BIGINT
);

ALTER TABLE "saved_contents" ADD CONSTRAINT "saved_contents_edited_content_check"
CHECK ("edited_result" IS NOT NULL OR "edited_text" IS NOT NULL);
