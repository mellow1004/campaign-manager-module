import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CampaignStatus } from "@prisma/client";

interface Params { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json() as { status?: CampaignStatus };

    const existing = await prisma.campaign.findUnique({
      where: { campaign_id: id },
      select: {
        status: true,
        assigned_pm_id: true,
        client_name: true,
        checklist_instances: {
          include: { template: { select: { type: true } } },
        },
      },
    });
    if (!existing) return NextResponse.json({ error: "Inte hittad" }, { status: 404 });

    const updated = await prisma.campaign.update({
      where: { campaign_id: id },
      data:  body,
    });

    // ── Status-change triggers ────────────────────────────────────────────
    if (body.status && body.status !== existing.status) {

      // Onboarding → create startup checklist if not exists
      if (body.status === "onboarding") {
        const hasStartup = existing.checklist_instances.some(
          (i) => i.template.type === "startup"
        );
        if (!hasStartup) {
          const template = await prisma.checklistTemplate.findFirst({
            where: { type: "startup" },
          });
          if (template) {
            const items = template.items as Array<{
              order: number; title: string; description?: string; is_blocking?: boolean;
            }>;
            await prisma.checklistInstance.create({
              data: {
                campaign: { connect: { campaign_id: id } },
                template: { connect: { template_id: template.template_id } },
                items: items.map((i) => ({ ...i, completed: false, completed_at: null })),
                completion_pct: 0,
              },
            });
          }
        }
      }

      // Closing → create closedown checklist if not exists
      if (body.status === "closing") {
        const hasClosedown = existing.checklist_instances.some(
          (i) => i.template.type === "closedown"
        );
        if (!hasClosedown) {
          const template = await prisma.checklistTemplate.findFirst({
            where: { type: "closedown" },
          });
          if (template) {
            const items = template.items as Array<{
              order: number; title: string; description?: string; is_blocking?: boolean;
            }>;
            await prisma.checklistInstance.create({
              data: {
                campaign: { connect: { campaign_id: id } },
                template: { connect: { template_id: template.template_id } },
                items: items.map((i) => ({ ...i, completed: false, completed_at: null })),
                completion_pct: 0,
              },
            });
          }
        }
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/campaigns/[id]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
