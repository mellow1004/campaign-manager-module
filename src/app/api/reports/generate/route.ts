import { NextRequest, NextResponse } from "next/server";

interface GenerateBody {
  clientName: string;
  market: string;
  weekNumber: number;
  activity: {
    dials: number;
    connects: number;
    emails_sent: number;
    replies: number;
    linkedin_requests: number;
    linkedin_accepted: number;
  };
  meetingsWeek: number;
  weeklyMeetingTarget: number;
  meetingsMtd: number;
  monthlyMeetingTarget: number;
  currentFocus: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as GenerateBody;

    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Return a placeholder if no API key is configured
      const onTrack = body.meetingsWeek >= body.weeklyMeetingTarget;
      const connectRate = body.activity.dials > 0
        ? Math.round((body.activity.connects / body.activity.dials) * 100)
        : 0;
      const commentary = `Vecka ${body.weekNumber} för ${body.clientName} (${body.market}) resulterade i ${body.meetingsWeek} bokade möten mot ett veckemål på ${body.weeklyMeetingTarget}. ${onTrack ? "Kampanjen är på rätt spår med bra aktivitetsnivåer." : "Det finns utrymme att öka aktiviteten för att nå veckamålet."} Connect-raten för veckan landade på ${connectRate}%, med ${body.activity.connects} connects på ${body.activity.dials} dials. Nästa vecka fokuserar vi på: ${body.currentFocus || "fortsatt prospektering"}.`;
      return NextResponse.json({ commentary });
    }

    const prompt = `Du är en erfaren B2B outbound-konsult på Brightvision.
Skriv en professionell veckokommentar på svenska för följande kampanj:

Klient: ${body.clientName}
Marknad: ${body.market}
Vecka: ${body.weekNumber}

Aktivitet denna vecka:
- Dials: ${body.activity.dials}, Connects: ${body.activity.connects}
- Email skickade: ${body.activity.emails_sent}, Svar: ${body.activity.replies}
- LinkedIn-förfrågningar: ${body.activity.linkedin_requests}, Accept: ${body.activity.linkedin_accepted}
- Möten bokade: ${body.meetingsWeek} (mål: ${body.weeklyMeetingTarget})
- MTD-möten: ${body.meetingsMtd} (mål: ${body.monthlyMeetingTarget})

ICP-fokus denna vecka: ${body.currentFocus}

Skriv 3–4 meningar. Lyft fram vad som gick bra, nämn en utmaning om relevant,
och avsluta med vad nästa vecka fokuserar på. Professionell men varm ton.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 400,
        messages:   [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json() as {
      content: Array<{ type: string; text: string }>;
    };
    const commentary = data.content[0]?.text ?? "";
    return NextResponse.json({ commentary });
  } catch (err) {
    console.error("POST /api/reports/generate", err);
    return NextResponse.json({ error: "Kunde inte generera kommentar" }, { status: 500 });
  }
}
