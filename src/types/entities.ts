export type CampaignStatus = "onboarding" | "active" | "paused" | "closing" | "closed";
export type IcpStatus = "draft" | "approved" | "active";
export type WeeklyReportStatus = "draft" | "sent";
export type TaskPriority = "high" | "medium" | "low";
export type TaskStatus = "open" | "in_progress" | "done";
export type TaskType = "manual" | "checklist_item" | "auto_generated";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly";
export type ChecklistType = "startup" | "weekly" | "closedown";
export type UserRole = "pm" | "tl" | "admin";

export interface Campaign {
  campaign_id: string;
  client_name: string;
  client_logo_url: string | null;
  start_date: string;
  end_date: string;
  status: CampaignStatus;
  market: string;
  language: string;
  channels_enabled: string[];
  assigned_pm_id: string;
  assigned_tl_id: string;
  health_score: number;
  weekly_meeting_target: number;
  monthly_meeting_target: number;
  meetings_booked_mtd: number;
  contract_type: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  log_id: string;
  campaign_id: string;
  date: string;
  dials: number;
  connects: number;
  emails_sent: number;
  replies: number;
  linkedin_requests: number;
  linkedin_accepted: number;
  meetings_booked: number;
  logged_by_id: string;
  created_at: string;
}

export interface ICP {
  icp_id: string;
  campaign_id: string;
  version: number;
  status: IcpStatus;
  industry_verticals: string[];
  company_sizes: string[];
  geographies: string[];
  job_titles: string[];
  pain_points: string[];
  key_messages: string[];
  exclusion_domains: string[];
  current_focus: string;
  estimated_pool_size: number;
  approved_by_id: string;
  created_at: string;
}

export interface WeeklyReport {
  report_id: string;
  campaign_id: string;
  week_number: number;
  year: number;
  status: WeeklyReportStatus;
  meetings_week: number;
  meetings_mtd: number;
  meetings_total: number;
  activity_summary: Record<string, unknown>;
  ai_commentary: string;
  pm_commentary: string;
  next_week_focus: string;
  recipients: string[];
  sent_at: string | null;
  sent_by_id: string;
}

export interface Task {
  task_id: string;
  campaign_id: string | null;
  title: string;
  description: string;
  due_date: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigned_to_id: string;
  created_by_id: string;
  task_type: TaskType;
  recurrence: TaskRecurrence;
  completed_at: string | null;
  created_at: string;
}

export interface ChecklistTemplate {
  template_id: string;
  type: ChecklistType;
  name: string;
  items: unknown[];
  version: number;
  created_at: string;
}

export interface ChecklistInstance {
  instance_id: string;
  template_id: string;
  campaign_id: string;
  week_number: number | null;
  year: number | null;
  items: unknown[];
  completion_pct: number;
  created_at: string;
}

export interface User {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_initials: string;
  supabase_auth_id: string;
  created_at: string;
}
