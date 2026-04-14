import "dotenv/config";
import { PrismaClient, CampaignStatus, UserRole, TaskPriority, TaskStatus, IcpStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL saknas i miljövariablerna.");

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

// ─── USERS ───────────────────────────────────────────────────────────────────

const PM_USERS = [
  { email: "anna.lindberg@brightvision.se",  name: "Anna Lindberg",  role: UserRole.pm, avatar_initials: "AL", supabase_auth_id: "11111111-1111-1111-1111-111111111111" },
  { email: "erik.svensson@brightvision.se",  name: "Erik Svensson",  role: UserRole.pm, avatar_initials: "ES", supabase_auth_id: "22222222-2222-2222-2222-222222222222" },
  { email: "sara.johansson@brightvision.se", name: "Sara Johansson", role: UserRole.pm, avatar_initials: "SJ", supabase_auth_id: "33333333-3333-3333-3333-333333333333" },
] as const;

const TL_USER = {
  email: "daniel.nyberg@brightvision.se", name: "Daniel Nyberg",
  role: UserRole.tl, avatar_initials: "DN", supabase_auth_id: "44444444-4444-4444-4444-444444444444",
} as const;

// ─── CAMPAIGNS ───────────────────────────────────────────────────────────────

interface CampaignSeed {
  clientName: string; market: string; language: string;
  status: CampaignStatus; healthScore: number;
  weeklyMeetingTarget: number; monthlyMeetingTarget: number; meetingsBookedMtd: number;
}

const CAMPAIGNS: CampaignSeed[] = [
  { clientName: "Microsoft DACH",      market: "DE/EN",    language: "EN", status: CampaignStatus.active,     healthScore: 92, weeklyMeetingTarget: 6, monthlyMeetingTarget: 24, meetingsBookedMtd: 21 },
  { clientName: "Oracle Nordic",        market: "SE/NO/DK", language: "EN", status: CampaignStatus.active,     healthScore: 61, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 13 },
  { clientName: "Cisco UK",             market: "UK/EN",    language: "EN", status: CampaignStatus.active,     healthScore: 88, weeklyMeetingTarget: 6, monthlyMeetingTarget: 24, meetingsBookedMtd: 19 },
  { clientName: "Dell Technologies PL", market: "PL/EN",    language: "EN", status: CampaignStatus.active,     healthScore: 28, weeklyMeetingTarget: 4, monthlyMeetingTarget: 16, meetingsBookedMtd: 5  },
  { clientName: "Autodesk France",      market: "FR/FR",    language: "FR", status: CampaignStatus.active,     healthScore: 79, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 16 },
  { clientName: "SAP Benelux",          market: "NL/EN",    language: "EN", status: CampaignStatus.active,     healthScore: 55, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 11 },
  { clientName: "Salesforce DACH",      market: "DE/EN",    language: "EN", status: CampaignStatus.paused,     healthScore: 0,  weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 0  },
  { clientName: "IBM Nordic",           market: "SE/NO",    language: "EN", status: CampaignStatus.active,     healthScore: 67, weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 14 },
  { clientName: "Adobe UK",             market: "UK/EN",    language: "EN", status: CampaignStatus.active,     healthScore: 81, weeklyMeetingTarget: 6, monthlyMeetingTarget: 24, meetingsBookedMtd: 18 },
  { clientName: "ServiceNow SE",        market: "SE/SV",    language: "SV", status: CampaignStatus.closing,    healthScore: 0,  weeklyMeetingTarget: 4, monthlyMeetingTarget: 16, meetingsBookedMtd: 0  },
  { clientName: "Workday DACH",         market: "DE/EN",    language: "EN", status: CampaignStatus.active,     healthScore: 35, weeklyMeetingTarget: 4, monthlyMeetingTarget: 16, meetingsBookedMtd: 6  },
  { clientName: "HubSpot Nordic",       market: "SE/NO/DK", language: "EN", status: CampaignStatus.onboarding, healthScore: 0,  weeklyMeetingTarget: 5, monthlyMeetingTarget: 20, meetingsBookedMtd: 0  },
];

// ─── CHECKLIST TEMPLATE ITEMS ────────────────────────────────────────────────

const STARTUP_ITEMS = [
  { order: 1,  title: "Kickoff-möte genomfört med kund",        description: "Första mötet med kundens kontaktperson genomfört. Förväntningar, mål och kommunikationsvägar etablerade.", is_blocking: true  },
  { order: 2,  title: "ICP-dokument godkänt av kund",           description: "Målgruppsdefinition skickad till och godkänd av kunden.",                                                  is_blocking: true  },
  { order: 3,  title: "ICP inläst i prospekteringsverktyg",     description: "Kontaktlista baserad på godkänd ICP importerad och kvalitetssäkrad.",                                      is_blocking: true  },
  { order: 4,  title: "SDR(s) tilldelade och briefade",         description: "SDR-team utsett. Briefing genomförd om kund, ICP och mötesmål.",                                           is_blocking: true  },
  { order: 5,  title: "Email-sekvenser granskade och godkända", description: "Alla email-templates granskade av PM och godkända av kund.",                                               is_blocking: true  },
  { order: 6,  title: "LinkedIn-profiler optimerade",           description: "SDR:ernas LinkedIn-profiler optimerade för kampanjens målgrupp.",                                           is_blocking: false },
  { order: 7,  title: "HubSpot deal/kampanj skapad",            description: "Kampanj registrerad i HubSpot med korrekt pipeline-fas.",                                                  is_blocking: false },
  { order: 8,  title: "Veckans aktivitetsmål bekräftat",        description: "Första veckans dials/email/LinkedIn-mål kommunicerat till SDR-teamet.",                                    is_blocking: false },
  { order: 9,  title: "Rapportschema överenskommet med kund",   description: "Dag och format för veckorapport avtalat. Mottagare-lista bekräftad.",                                      is_blocking: false },
  { order: 10, title: "Kampanj skapad i Otto",                  description: "Kampanjen registrerad i Otto med korrekt start- och slutdatum, kanaler och mötes-mål.",                    is_blocking: true  },
];

const WEEKLY_ITEMS = [
  { order: 1, title: "Granska förra veckans aktivitetssiffror", description: "Kontrollera att alla dagar är loggade. Stämmer siffrorna?",                          is_blocking: false },
  { order: 2, title: "Uppdatera möteslistan",                   description: "Alla möten inlagda med kontakt, datum och kvalitetsmärkning.",                       is_blocking: false },
  { order: 3, title: "Kontrollera tasks och deadlines",         description: "Finns det försenade tasks? Eskalera vid behov.",                                     is_blocking: false },
  { order: 4, title: "Generera veckans rapport",                description: "Generera rapport i Otto, granska AI-kommentaren och komplettera vid behov.",         is_blocking: true  },
  { order: 5, title: "Skicka veckorapporten till kund",         description: "Rapport skickad senast tisdag EOD.",                                                 is_blocking: true  },
  { order: 6, title: "Uppdatera ICP vid behov",                 description: "Har fokus för nästa vecka förändrats? Uppdatera current_focus.",                    is_blocking: false },
  { order: 7, title: "Sätt mål för kommande vecka",             description: "Kommunicera veckans dials/email/LinkedIn-mål till SDR-teamet inför måndag.",        is_blocking: false },
];

const CLOSEDOWN_ITEMS = [
  { order: 1, title: "Slutrapport genererad och skickad",       description: "Sammanfattande slutrapport skickad till kunden.",                     is_blocking: true  },
  { order: 2, title: "Alla möten dokumenterade i CRM",          description: "Samtliga möten loggade med korrekt status i HubSpot.",               is_blocking: true  },
  { order: 3, title: "SDR-briefing om avslut",                  description: "SDR-teamet informerat om kampanjens avslut och nästa steg.",         is_blocking: false },
  { order: 4, title: "Kundfeedback inhämtad",                   description: "Kortenkät eller samtal med kundens kontaktperson genomfört.",        is_blocking: false },
  { order: 5, title: "ICP arkiverad",                           description: "ICP-dokumentet arkiverat för framtida referens.",                    is_blocking: false },
  { order: 6, title: "Otto-kampanj avslutad",                   description: "Kampanjstatus satt till 'Avslutad' i Otto.",                         is_blocking: true  },
  { order: 7, title: "Faktura utskickad",                       description: "Sista faktura skickad till kund.",                                   is_blocking: false },
  { order: 8, title: "Retrospektiv genomförd internt",          description: "Intern genomgång av vad som gick bra, vad som kan förbättras.",      is_blocking: false },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days); return d;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

function makeChecklistItems(templateItems: typeof STARTUP_ITEMS, completionPct: number) {
  const cutoff = Math.floor((completionPct / 100) * templateItems.length);
  return templateItems.map((item, i) => ({
    order: item.order,
    title: item.title,
    description: item.description,
    is_blocking: item.is_blocking,
    completed: i < cutoff,
    completed_at: i < cutoff ? daysAgo(templateItems.length - i + 2).toISOString() : null,
  }));
}

// ─── RESET ───────────────────────────────────────────────────────────────────

async function resetDatabase() {
  await prisma.activityLog.deleteMany();
  await prisma.iCP.deleteMany();
  await prisma.weeklyReport.deleteMany();
  await prisma.task.deleteMany();
  await prisma.checklistInstance.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.checklistTemplate.deleteMany();
  await prisma.user.deleteMany();
}

// ─── SEED ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Återställer databasen...");
  await resetDatabase();

  // 1. Users
  console.log("👤 Skapar användare...");
  const pms = await Promise.all(PM_USERS.map((pm) => prisma.user.create({ data: pm })));
  const tl  = await prisma.user.create({ data: TL_USER });
  const pmIds = pms.map((p) => p.user_id);

  // 2. Checklist templates
  console.log("📋 Skapar checklistmallar...");
  const startupTpl  = await prisma.checklistTemplate.create({ data: { type: "startup",   name: "Uppstartschecklista", items: STARTUP_ITEMS,   version: 1 } });
  const weeklyTpl   = await prisma.checklistTemplate.create({ data: { type: "weekly",    name: "Veckochecklista",     items: WEEKLY_ITEMS,    version: 1 } });
  const closedownTpl = await prisma.checklistTemplate.create({ data: { type: "closedown", name: "Avslutschecklista",   items: CLOSEDOWN_ITEMS, version: 1 } });

  // 3. Campaigns + all related data
  console.log("🎯 Skapar kampanjer, aktivitet, tasks, ICP och rapporter...");

  for (const [i, cs] of CAMPAIGNS.entries()) {
    const pmId     = pmIds[i % pmIds.length];
    const startDate = daysAgo(45 + i * 3);
    const endDate   = daysAgo(-(90 - i * 3));

    const campaign = await prisma.campaign.create({
      data: {
        client_name: cs.clientName,
        client_logo_url: null,
        start_date: startDate,
        end_date: endDate,
        status: cs.status,
        market: cs.market,
        language: cs.language,
        channels_enabled: i % 3 === 0 ? ["phone", "email", "linkedin"] : i % 3 === 1 ? ["phone", "email"] : ["email", "linkedin"],
        assigned_pm_id: pmId,
        assigned_tl_id: tl.user_id,
        health_score: cs.healthScore,
        weekly_meeting_target: cs.weeklyMeetingTarget,
        monthly_meeting_target: cs.monthlyMeetingTarget,
        meetings_booked_mtd: cs.meetingsBookedMtd,
        contract_type: i % 2 === 0 ? "retainer" : "project",
      },
    });

    // ── Activity logs (30 days) ──
    const activityRows = Array.from({ length: 30 }, (_, offset) => {
      const day     = daysAgo(29 - offset);
      const weekday = day.getDay();
      const isWd    = weekday >= 1 && weekday <= 5;
      const base    = Math.max(0.35, cs.healthScore / 100);
      const dials   = isWd ? Math.round((45 + (i % 7) * 4) * base) : 0;
      const connects = isWd ? Math.round(dials * (0.16 + (i % 3) * 0.02)) : 0;
      const emails   = isWd ? Math.round((30 + (i % 5) * 3) * base) : 0;
      const replies  = isWd ? Math.round(emails * (0.07 + (i % 4) * 0.01)) : 0;
      const liReq    = isWd ? Math.round((12 + (i % 4) * 2) * base) : 0;
      const liAcc    = isWd ? Math.round(liReq * 0.38) : 0;
      const meetings = isWd ? Math.min(3, Math.round((cs.healthScore / 40) * ((offset % 3) + 0.25))) : 0;
      return { campaign_id: campaign.campaign_id, date: day, dials, connects, emails_sent: emails, replies, linkedin_requests: liReq, linkedin_accepted: liAcc, meetings_booked: meetings, logged_by_id: pmId };
    });
    await prisma.activityLog.createMany({ data: activityRows });

    // ── ICP (only for non-paused/onboarding) ──
    if (cs.status === "active" || cs.status === "closing") {
      await prisma.iCP.create({
        data: {
          campaign:           { connect: { campaign_id: campaign.campaign_id } },
          version:            1,
          status:             IcpStatus.active,
          industry_verticals: ["SaaS", "Enterprise Software", "IT Services"].slice(0, 2 + (i % 2)),
          company_sizes:      ["201-500", "501-1000", "1001-5000"],
          geographies:        cs.market.split("/").filter((m) => m !== "EN" && m !== "SV" && m !== "FR"),
          job_titles:         ["IT Director", "CTO", "VP of Engineering", "Head of IT"].slice(0, 2 + (i % 3)),
          pain_points:        ["Ineffektiva processer", "Skalbarhetsproblem", "Kostnadsoptimering"].slice(0, 2 + (i % 2)),
          key_messages:       ["ROI inom 6 månader", "Smidig onboarding", "Enterprise-grade support"],
          exclusion_domains:  i % 3 === 0 ? ["competitor.com", "rival.se"] : [],
          current_focus:      `v.${isoWeek(new Date())} – Fokus på ${["C-suite", "IT-direktörer", "Tekniska beslutsfattare"][i % 3]}`,
          estimated_pool_size: 800 + i * 150,
          approved_by:        { connect: { user_id: tl.user_id } },
        },
      });
    }

    // ── Tasks (mix of statuses and priorities) ──
    if (cs.status !== "paused") {
      const taskDefs = [
        { title: "Granska SDR-aktivitet v." + isoWeek(new Date()),    priority: TaskPriority.high,   status: TaskStatus.open,        dueOffset: 0 },
        { title: "Skicka veckorapport till kund",                      priority: TaskPriority.high,   status: TaskStatus.open,        dueOffset: 0 },
        { title: "Uppdatera ICP med nytt fokusområde",                 priority: TaskPriority.medium, status: TaskStatus.in_progress, dueOffset: 2 },
        { title: "Boka check-in med " + cs.clientName,                 priority: TaskPriority.medium, status: TaskStatus.open,        dueOffset: 3 },
        { title: "Verifiera möteskvalitet i HubSpot",                  priority: TaskPriority.low,    status: TaskStatus.open,        dueOffset: 5 },
        { title: "Optimera email-sekvens steg 3",                      priority: TaskPriority.medium, status: TaskStatus.in_progress, dueOffset: 4 },
        { title: "Stäm av SDR-kapacitet inför nästa vecka",            priority: TaskPriority.low,    status: TaskStatus.done,        dueOffset: -3 },
        { title: "Sammanställ möteslista MTD",                         priority: TaskPriority.medium, status: TaskStatus.done,        dueOffset: -5 },
      ].slice(0, 5 + (i % 4)); // Varying number of tasks per campaign

      // Add an overdue high-prio task for red/yellow campaigns
      if (cs.healthScore < 75) {
        taskDefs.unshift({
          title: "⚠ Aktivitetslogg saknas – åtgärda omgående",
          priority: TaskPriority.high,
          status: TaskStatus.open,
          dueOffset: -2, // overdue
        });
      }

      for (const t of taskDefs) {
        await prisma.task.create({
          data: {
            campaign:    { connect: { campaign_id: campaign.campaign_id } },
            title:       t.title,
            description: "",
            due_date:    daysAgo(-t.dueOffset),
            priority:    t.priority,
            status:      t.status,
            assigned_to: { connect: { user_id: pmId } },
            created_by:  { connect: { user_id: pmId } },
            task_type:   "manual",
            recurrence:  "none",
            completed_at: t.status === "done" ? daysAgo(Math.abs(t.dueOffset) + 1) : null,
          },
        });
      }
    }

    // ── Checklist instances ──
    if (cs.status === "onboarding") {
      const pct = 40 + (i % 3) * 10;
      await prisma.checklistInstance.create({
        data: {
          template:       { connect: { template_id: startupTpl.template_id } },
          campaign:       { connect: { campaign_id: campaign.campaign_id } },
          week_number:    null,
          year:           null,
          items:          makeChecklistItems(STARTUP_ITEMS, pct),
          completion_pct: pct,
        },
      });
    } else if (cs.status === "closing") {
      await prisma.checklistInstance.create({
        data: {
          template:       { connect: { template_id: closedownTpl.template_id } },
          campaign:       { connect: { campaign_id: campaign.campaign_id } },
          items:          makeChecklistItems(CLOSEDOWN_ITEMS, 50),
          completion_pct: 50,
        },
      });
    } else if (cs.status === "active") {
      for (let w = 0; w < 3; w++) {
        const weekDate = daysAgo(w * 7);
        const wk = isoWeek(weekDate);
        const pct = w === 0 ? 60 : 100;
        await prisma.checklistInstance.create({
          data: {
            template:       { connect: { template_id: weeklyTpl.template_id } },
            campaign:       { connect: { campaign_id: campaign.campaign_id } },
            week_number:    wk,
            year:           weekDate.getFullYear(),
            items:          makeChecklistItems(WEEKLY_ITEMS, pct),
            completion_pct: pct,
          },
        });
      }
    }

    // ── Weekly reports (last 4 weeks for active/closing) ──
    if (cs.status === "active" || cs.status === "closing") {
      for (let w = 1; w <= 4; w++) {
        const reportDate = daysAgo(w * 7);
        const wk        = isoWeek(reportDate);
        const isSent    = w > 1 || cs.healthScore > 60;
        const meetingsW = Math.round(cs.weeklyMeetingTarget * (0.5 + cs.healthScore / 200));
        await prisma.weeklyReport.create({
          data: {
            campaign:       { connect: { campaign_id: campaign.campaign_id } },
            week_number:    wk,
            year:           reportDate.getFullYear(),
            status:         isSent ? "sent" : "draft",
            meetings_week:  meetingsW,
            meetings_mtd:   cs.meetingsBookedMtd,
            meetings_total: cs.meetingsBookedMtd + w * 2,
            activity_summary: {
              dials: 180 + i * 10, connects: 28 + i * 2,
              emails_sent: 120 + i * 8, replies: 9 + i,
              linkedin_requests: 55 + i * 3, linkedin_accepted: 21 + i,
            },
            ai_commentary:   `Kampanjen visade ${cs.healthScore > 75 ? "stark" : "stabil"} aktivitet under vecka ${wk}. ${meetingsW >= cs.weeklyMeetingTarget ? "Veckans mötesmål uppnåddes" : `${meetingsW} av ${cs.weeklyMeetingTarget} möten bokades`}. Fokus nästa vecka: stärka pipeline inom ${["C-suite", "IT-direktörer", "tekniska beslutsfattare"][i % 3]}.`,
            pm_commentary:   isSent ? "Bra vecka sammantaget. Fortsätter med befintlig strategi." : "",
            next_week_focus: `Öka dial-volym och följa upp ${w === 1 ? "varma" : "nya"} kontakter.`,
            recipients:      ["kontakt@" + cs.clientName.toLowerCase().replace(/ /g, "") + ".com"],
            sent_at:         isSent ? daysAgo(w * 7 - 1) : null,
            // sent_by_id is required (String, not String?) — always link to PM
            sent_by:         { connect: { user_id: pmId } },
          },
        });
      }
    }
  }

  console.log("✅ Seed klar!");
  console.log(`   👤 ${pms.length + 1} användare`);
  console.log(`   🎯 ${CAMPAIGNS.length} kampanjer`);
  console.log("   📊 Aktivitetsloggar, tasks, ICP, checklistor och rapporter skapade");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err: unknown) => {
    console.error("Seed misslyckades:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
