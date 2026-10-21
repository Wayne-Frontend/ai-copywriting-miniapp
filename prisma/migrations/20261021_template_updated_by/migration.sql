-- 历史模板缺少可追溯的修改者，保持 NULL，避免将发布人误记为更新人。
ALTER TABLE "templates" ADD COLUMN "updated_by" UUID;

ALTER TABLE "templates" ADD CONSTRAINT "templates_updated_by_fkey"
    FOREIGN KEY ("updated_by") REFERENCES "admin_users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
