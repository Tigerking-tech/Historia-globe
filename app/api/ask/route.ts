import { NextRequest, NextResponse } from "next/server";
import {
  getEventsForDate,
  getHeritageSites,
  buildDayContext,
  formatYear,
  fetchWithTimeout,
  MONTHS,
} from "@/lib/history";
import { groundingRules } from "@/lib/ask-yore/context";
import config from "@/config";

export const maxDuration = 30;

function fallbackNarrative(
  m: number,
  d: number,
  events: any[],
  _heritage: any[],
  question?: string
): string {
  const dateLabel = `${MONTHS[m - 1]} ${d}`;
  const placed = events.filter((e) => e.lat != null);
  if (!placed.length) {
    return `On ${dateLabel}, our curated record does not yet pin specific located events${
      question ? `. Regarding your question — "${question}" —` : "."
    } this day in the past has seen revolutions, discoveries and tragedies unfold across continents. Pick any date on the globe to explore them, or add an LLM key so Historia can weave the day's global threads into one connected story.`;
  }
  const lines = placed
    .map((e) => `• ${formatYear(e.year)} — ${e.title} (${e.place}). ${e.description}`)
    .join("\n");
  return `On ${dateLabel}, the world was busy in many places at once:\n\n${lines}\n\nSeen together, these moments show how politics, conflict, discovery and culture advanced on the same calendar day across different continents — a single date holding many parallel human stories. Add an LLM key to let Historia narrate the connections in prose.`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const m = parseInt(body.month, 10);
  const d = parseInt(body.day, 10);
  const question: string | undefined = body.question || undefined;
  // AskYore 阶段 1：前端可选传入场景快照，回答贴合用户眼前所见（语言/视图/选中事件/相机）。
  const scene = body.scene && typeof body.scene === "object" ? body.scene : null;
  if (!m || !d) {
    return NextResponse.json({ error: "month and day are required" }, { status: 400 });
  }
  try {

    const [events, heritage] = await Promise.all([
      getEventsForDate(m, d),
      getHeritageSites(),
    ]);
    const context = buildDayContext(m, d, events, heritage);

    const sys =
      "You are Historia, a thoughtful historian with a calm, editorial voice. You are given a date and the global historical events recorded on that day — many from different countries, happening in the same 24 hours across the world. Your job is to weave these threads together: explain how events on opposite sides of the planet on the SAME day connect, contrast, or reveal a shared human story. Base every claim on the provided context; never invent facts. If the context is thin, say so honestly and offer what is known. Write 3-5 short paragraphs.\n\n" +
      groundingRules(scene?.lang === "zh" ? "zh" : "en");

    const cam = scene?.camera;
    const sceneLine = scene
      ? `\n\nUser's current view: lang=${scene.lang || "en"}, globe=${
          scene.realEarth ? "real 3D" : "classic"
        }, view=${scene.view || "satellite"}${
          scene.selectedEventId ? `, selected event [${scene.selectedEventId}]` : ""
        }${
          cam && Number.isFinite(Number(cam.lat)) && Number.isFinite(Number(cam.lon))
            ? `, camera ${Number(cam.lat).toFixed(2)},${Number(cam.lon).toFixed(2)} @ ${Math.round(Number(cam.alt) || 0)}m`
            : ""
        }.`
      : "";
    const user = `Date in focus: ${MONTHS[m - 1]} ${d}.${sceneLine}\n\nContext (events + UNESCO World Heritage in those regions):\n${context}\n\nQuestion: ${
      question || "Help me see this day as one connected global story."
    }`;

    const apiKey = config.llm.apiKey;
    if (!apiKey) {
      return NextResponse.json({
        answer: fallbackNarrative(m, d, events, heritage, question),
        source: "local",
      });
    }

    try {
      const resp = await fetchWithTimeout(
        `${config.llm.baseUrl}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: config.llm.model,
            messages: [
              { role: "system", content: sys },
              { role: "user", content: user },
            ],
            temperature: 0.7,
          }),
        },
        8000
      );

      if (!resp.ok) {
        return NextResponse.json({
          answer: fallbackNarrative(m, d, events, heritage, question),
          source: "local",
        });
      }
      const data = await resp.json();
      const answer =
        data.choices?.[0]?.message?.content ||
        fallbackNarrative(m, d, events, heritage, question);
      return NextResponse.json({ answer, source: "ai" });
    } catch {
      // LLM unreachable / timed out — degrade gracefully to the local weave.
      return NextResponse.json({
        answer: fallbackNarrative(m, d, events, heritage, question),
        source: "local",
      });
    }
  } catch (e) {
    // Last-resort guard: never leave the client hanging with no answer.
    return NextResponse.json({
      answer: fallbackNarrative(m, d, [], [], question),
      source: "local",
    });
  }
}
