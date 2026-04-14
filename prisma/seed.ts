import { PrismaClient, CampaignStatus, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

interface CampaignSeed {
  clientName: string;
  market: string;
  language: string;
  status: CampaignStatus;
  healthScore: number;
  weeklyMeetingTarget: number;
  monthlyMeetingTarget: number;
  meetingsBookedMtd: number;
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL saknas i miljövariablerna.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });

const prisma = new PrismaClient({
  adapter,
});

const PM_USERS = [
  {
    email: "anna.lindberg@brightvision.se",
    name: "Anna Lindberg",
    role: UserRole.pm,
    avatar_initials: "AL",
    supabase_auth_id: "11111111-1111-1111-1111-111111111111",
  },
  {
    email: "erik.svensson@brightvision.se",
    name: "Erik Svensson",
    role: UserRole.pm,
    avatar_initials: "ES",
    supabase_auth_id: "22222222-2222-2222-2222-222222222222",
  },
  {
    email: "sara.johansson@brightvision.se",
    name: "Sara Johansson",
    role: UserRole.pm,
    avatar_initials: "SJ",
    supabase_auth_id: "33333333-3333-3333-3333-333333333333",
  },
] as const;

const TL_USER = {
  email: "daniel.nyberg@brightvision.se",
  name: "Daniel Nyberg",
  role: UserRole.tl,
  avatar_initials: "DN",
  supabase_auth_id: "44444444-4444-4444-4444-444444444444",
} as const;

const CAMPAIGNS: CampaignSeed[] = [
  { clientName: "Microsoft DACH", market: "DE/EN", language: "EN", status: CampaignStatus.active, healthScore: 92, weeklyMeetingTarget: 6, monthlyMeetingTarget: 24, meetingsBookedMtd: 21 },
  { clientName: "Oracle Nordic", market: "SE/NO/DK", language: "EN", status: CampaignStatus.active, healthScore: 61, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 13 },
  { clientName: "Cisco UK", market: "UK/EN", language: "EN", status: CampaignStatus.active, healthScore: 88, weeklyMeetingTarget: 6, monthlyMeetingTarget: 24, meetingsBookedMtd: 19 },
  { clientName: "Dell Technologies PL", market: "PL/EN", language: "EN", status: CampaignStatus.active, healthScore: 28, weeklyMeetingTarget: 4, monthlyMeetingTarget: 16, meetingsBookedMtd: 5 },
  { clientName: "Autodesk France", market: "FR/FR", language: "FR", status: CampaignStatus.active, healthScore: 79, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 16 },
  { clientName: "SAP Benelux", market: "NL/EN", language: "EN", status: CampaignStatus.active, healthScore: 55, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 11 },
  { clientName: "Salesforce DACH", market: "DE/EN", language: "EN", status: CampaignStatus.paused, healthScore: 0, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 0 },
  { clientName: "IBM Nordic", market: "SE/NO", language: "EN", status: CampaignStatus.active, healthScore: 67, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 14 },
  { clientName: "Adobe UK", market: "UK/EN", language: "EN", status: CampaignStatus.active, healthScore: 81, weeklyMeetingTarget: 6, monthlyMeetingTarget: 24, meetingsBookedMtd: 18 },
  { clientName: "ServiceNow SE", market: "SE/SV", language: "SV", status: CampaignStatus.closing, healthScore: 0, weeklyMeetingTarget: 4, monthlyMeetingTarget: 16, meetingsBookedMtd: 0 },
  { clientName: "Workday DACH", market: "DE/EN", language: "EN", status: CampaignStatus.active, healthScore: 35, weeklyMeetingTarget: 4, monthlyMeetingTarget: 16, meetingsBookedMtd: 6 },
  { clientName: "HubSpot Nordic", market: "SE/NO/DK", language: "EN", status: CampaignStatus.onboarding, healthScore: 0, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 0 },
];

function daysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

async function resetDatabase(): Promise<void> {
  await prisma.activityLog.deleteMany();
  await prisma.iCP.deleteMany();
  await prisma.weeklyReport.deleteMany();
  await prisma.task.deleteMany();
  await prisma.checklistInstance.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers() {
  const createdPms = await Promise.all(
    PM_USERS.map((pm) =>
      prisma.user.create({
        data: pm,
      }),
    ),
  );

  const tl = await prisma.user.create({
    data: TL_USER,
  });

  return { createdPms, tl };
}

async function seedCampaignsAndActivity(pmIds: string[], tlId: string): Promise<void> {
  for (const [campaignIndex, campaignSeed] of CAMPAIGNS.entries()) {
    const assignedPmId = pmIds[campaignIndex % pmIds.length];
    const startDate = daysAgo(45 + campaignIndex * 2);
    const endDate = daysAgo(-(75 - campaignIndex * 2));

    const campaign = await prisma.campaign.create({
      data: {
        client_name: campaignSeed.clientName,
        client_logo_url: null,
        start_date: startDate,
        end_date: endDate,
        status: campaignSeed.status,
        market: campaignSeed.market,
        language: campaignSeed.language,
        channels_enabled: ["phone", "email", "linkedin"],
        assigned_pm_id: assignedPmId,
        assigned_tl_id: tlId,
        health_score: campaignSeed.healthScore,
        weekly_meeting_target: campaignSeed.weeklyMeetingTarget,
        monthly_meeting_target: campaignSeed.monthlyMeetingTarget,
        meetings_booked_mtd: campaignSeed.meetingsBookedMtd,
        contract_type: "retainer",
      },
    });

    const activityRows = Array.from({ length: 30 }, (_, dayOffset) => {
      const day = daysAgo(29 - dayOffset);
      const weekday = day.getDay();
      const isWeekday = weekday >= 1 && weekday <= 5;
      const baseFactor = Math.max(0.35, campaignSeed.healthScore / 100);

      const dials = isWeekday ? Math.round((45 + (campaignIndex % 7) * 4) * baseFactor) : 0;
      const connects = isWeekday ? Math.round(dials * (0.16 + (campaignIndex % 3) * 0.02)) : 0;
      const emailsSent = isWeekday ? Math.round((30 + (campaignIndex % 5) * 3) * baseFactor) : 0;
      const replies = isWeekday ? Math.round(emailsSent * (0.07 + (campaignIndex % 4) * 0.01)) : 0;
      const linkedinRequests = isWeekday ? Math.round((12 + (campaignIndex % 4) * 2) * baseFactor) : 0;
      const linkedinAccepted = isWeekday ? Math.round(linkedinRequests * 0.38) : 0;
      const meetingsBooked = isWeekday ? Math.min(3, Math.round((campaignSeed.healthScore / 40) * ((dayOffset % 3) + 0.25))) : 0;

      return {
        campaign_id: campaign.campaign_id,
        date: day,
        dials,
        connects,
        emails_sent: emailsSent,
        replies,
        linkedin_requests: linkedinRequests,
        linkedin_accepted: linkedinAccepted,
        meetings_booked: meetingsBooked,
        logged_by_id: assignedPmId,
      };
    });

    await prisma.activityLog.createMany({
      data: activityRows,
    });
  }
}

async function main(): Promise<void> {
  await resetDatabase();
  const { createdPms, tl } = await seedUsers();
  await seedCampaignsAndActivity(
    createdPms.map((pm) => pm.user_id),
    tl.user_id,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
