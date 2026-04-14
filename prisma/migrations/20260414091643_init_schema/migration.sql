-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('onboarding', 'active', 'paused', 'closing', 'closed');

-- CreateEnum
CREATE TYPE "IcpStatus" AS ENUM ('draft', 'approved', 'active');

-- CreateEnum
CREATE TYPE "WeeklyReportStatus" AS ENUM ('draft', 'sent');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('manual', 'checklist_item', 'auto_generated');

-- CreateEnum
CREATE TYPE "TaskRecurrence" AS ENUM ('none', 'daily', 'weekly', 'monthly');

-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('startup', 'weekly', 'closedown');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('pm', 'tl', 'admin');

-- CreateTable
CREATE TABLE "Campaign" (
    "campaign_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_logo_url" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "CampaignStatus" NOT NULL,
    "market" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "channels_enabled" TEXT[],
    "assigned_pm_id" TEXT NOT NULL,
    "assigned_tl_id" TEXT NOT NULL,
    "health_score" INTEGER NOT NULL,
    "weekly_meeting_target" INTEGER NOT NULL,
    "monthly_meeting_target" INTEGER NOT NULL,
    "meetings_booked_mtd" INTEGER NOT NULL,
    "contract_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("campaign_id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "log_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "dials" INTEGER NOT NULL,
    "connects" INTEGER NOT NULL,
    "emails_sent" INTEGER NOT NULL,
    "replies" INTEGER NOT NULL,
    "linkedin_requests" INTEGER NOT NULL,
    "linkedin_accepted" INTEGER NOT NULL,
    "meetings_booked" INTEGER NOT NULL,
    "logged_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "ICP" (
    "icp_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "IcpStatus" NOT NULL,
    "industry_verticals" TEXT[],
    "company_sizes" TEXT[],
    "geographies" TEXT[],
    "job_titles" TEXT[],
    "pain_points" TEXT[],
    "key_messages" TEXT[],
    "exclusion_domains" TEXT[],
    "current_focus" TEXT NOT NULL,
    "estimated_pool_size" INTEGER NOT NULL,
    "approved_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ICP_pkey" PRIMARY KEY ("icp_id")
);

-- CreateTable
CREATE TABLE "WeeklyReport" (
    "report_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "week_number" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "WeeklyReportStatus" NOT NULL,
    "meetings_week" INTEGER NOT NULL,
    "meetings_mtd" INTEGER NOT NULL,
    "meetings_total" INTEGER NOT NULL,
    "activity_summary" JSONB NOT NULL,
    "ai_commentary" TEXT NOT NULL,
    "pm_commentary" TEXT NOT NULL,
    "next_week_focus" TEXT NOT NULL,
    "recipients" TEXT[],
    "sent_at" TIMESTAMP(3),
    "sent_by_id" TEXT NOT NULL,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "Task" (
    "task_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "priority" "TaskPriority" NOT NULL,
    "status" "TaskStatus" NOT NULL,
    "assigned_to_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "task_type" "TaskType" NOT NULL,
    "recurrence" "TaskRecurrence" NOT NULL,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("task_id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "template_id" TEXT NOT NULL,
    "type" "ChecklistType" NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("template_id")
);

-- CreateTable
CREATE TABLE "ChecklistInstance" (
    "instance_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "week_number" INTEGER,
    "year" INTEGER,
    "items" JSONB NOT NULL,
    "completion_pct" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistInstance_pkey" PRIMARY KEY ("instance_id")
);

-- CreateTable
CREATE TABLE "User" (
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "avatar_initials" TEXT NOT NULL,
    "supabase_auth_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabase_auth_id_key" ON "User"("supabase_auth_id");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_assigned_pm_id_fkey" FOREIGN KEY ("assigned_pm_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_assigned_tl_id_fkey" FOREIGN KEY ("assigned_tl_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ICP" ADD CONSTRAINT "ICP_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ICP" ADD CONSTRAINT "ICP_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("campaign_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "ChecklistTemplate"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "Campaign"("campaign_id") ON DELETE RESTRICT ON UPDATE CASCADE;
