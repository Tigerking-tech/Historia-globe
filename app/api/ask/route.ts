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
import { checkQuota, recordUsage, INPUT_MAX_CHARS, OUTPUT_MAX_TOKENS } from "@/lib/quota";
import config from "@/config";

export const maxDuration = 30;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  return (fwd.split(",")[0] || req.headers.get("x-real-ip") || "local").trim().slice(0, 80);
}

/** AI 回答的逐条出处：每条事件一个可点击链接，让回答可溯源（P2）。 */
function buildSources(events: any[]) {
  return events
    .filter((e) => e && e.title)
    .slice(0, 8)
    .map((e, i) => ({
      n: i + 1,
      title: String(e.title).slice(0, 160),
      year: Number(e.year) || 0,
      place: String(e.place || "").slice(0, 120),
      url:
        e.sourceUrl ||
        `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(String(e.title))}`,
      source: e.source || "curated",
    }));
}

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
    .map((e, i) => `[${i + 1}] ${formatYear(e.year)} — ${e.title} (${e.place}). ${e.description}`)
    .join("\n");
  return `On ${dateLabel}, the world was busy in many places at once:\n\n${lines}\n\nSeen together, these moments show how politics, conflict, discovery and culture advanced on the same calendar day across different continents — a single date holding many parallel human stories. Each [n] below links to its source. Add an LLM key to let Historia narrate the connections in prose.`;
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

  // ---- 免费层配额护栏：输入长度 / 每分钟频率 / 每日 token 硬顶 ----
  const ip = clientIp(req);
  const input = String(question || "").slice(0, INPUT_MAX_CHARS * 4);
  const quota = checkQuota(ip, input);
  if (!quota.allowed) {
    const msg: Record<string, string> = {
      input_too_long: `Question too long (max ${INPUT_MAX_CHARS} characters).`,
      rate_limited: "Too many questions this minute. Please wait a moment.",
      daily_cap: "Daily free AI budget reached for this network. The local summary is still available.",
    };
    return NextResponse.json(
      { error: quota.reason, message: msg[quota.reason], quota },
      { status: quota.reason === "input_too_long" ? 413 : 429 }
    );
  }

  try {
    const [events, heritage] = await Promise.all([
      getEventsForDate(m, d),
      getHeritageSites(),
    ]);
    const context = buildDayContext(m, d, events, heritage);
    const sources = buildSources(events);
    const sourceList = sources
      .map((s) => `[${s.n}] ${s.title} (${s.year}) — ${s.url}`)
      .join("\n");

    const sys =
      "You are Historia, a thoughtful historian with a calm, editorial voice. You are given a date and the global historical events recorded on that day — many from different countries, happening in the same 24 hours across the world. Your job is to weave these threads together: explain how events on opposite sides of the planet on the SAME day connect, contrast, or reveal a shared human story. Base every claim on the provided context; never invent facts. If the context is thin, say so honestly and offer what is known. Write 3-5 short paragraphs.\n\n" +
      "CITATION RULE: when you mention a specific event, append its marker like [1], [2] exactly as listed in the SOURCES block. Never invent a source number. Do not add a bibliography — the client renders the numbered source list.\n\n" +
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
    const user = `Date in focus: ${MONTHS[m - 1]} ${d}.${sceneLine}\n\nContext (events + UNESCO World Heritage in those regions):\n${context}\n\nSOURCES (use these exact numbers):\n${sourceList || "(no sources available — say the record is thin)"}\n\nQuestion: ${
      question || "Help me see this day as one connected global story."
    }`;

    const apiKey = config.llm.apiKey;
    if (!apiKey) {
      const answer = fallbackNarrative(m, d, events, heritage, question);
      recordUsage(ip, input, answer);
      return NextResponse.json({ answer, source: "local", sources, quota });
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
            // 服务端硬顶，客户端无法覆盖：防止单次回答烧穿 token
            max_tokens: OUTPUT_MAX_TOKENS,
          }),
        },
        8000
      );

      if (!resp.ok) {
        const answer = fallbackNarrative(m, d, events, heritage, question);
        recordUsage(ip, input, answer);
        return NextResponse.json({ answer, source: "local", sources, quota });
      }
      const data = await resp.json();
      const answer =
        data.choices?.[0]?.message?.content ||
        fallbackNarrative(m, d, events, heritage, question);
      recordUsage(ip, input, answer);
      return NextResponse.json({ answer, source: "ai", sources, quota });
    } catch {
      // LLM unreachable / timed out — degrade gracefully to the local weave.
      const answer = fallbackNarrative(m, d, events, heritage, question);
      recordUsage(ip, input, answer);
      return NextResponse.json({ answer, source: "local", sources, quota });
    }
  } catch (e) {
    // Last-resort guard: never leave the client hanging with no answer.
    return NextResponse.json({
      answer: fallbackNarrative(m, d, [], [], question),
      source: "local",
      sources: [],
      quota,
    });
  }
}
