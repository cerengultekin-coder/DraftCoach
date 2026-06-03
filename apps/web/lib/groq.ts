import Groq from "groq-sdk";

export const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SPORT_MAP: Record<string, string> = {
  Ride: "cycling", VirtualRide: "cycling", EBikeRide: "cycling", Velomobile: "cycling", Handcycle: "cycling",
  Run: "running", VirtualRun: "running", TrailRun: "running",
  Swim: "swimming",
  Walk: "walking", Hike: "walking",
  WeightTraining: "strength", Workout: "strength", Crossfit: "strength", RockClimbing: "strength",
  Yoga: "yoga",
  Rowing: "water", Kayaking: "water", Canoeing: "water", Surfing: "water", SUP: "water", Windsurf: "water", Kitesurf: "water",
  AlpineSki: "winter", BackcountrySki: "winter", CrossCountrySkiing: "winter",
  Snowboard: "winter", Snowshoe: "winter", IceSkate: "winter", NordicSki: "winter",
};

const SPORT_COACH: Record<string, [string, string]> = {
  cycling:  ["deneyimli bir bisiklet antrenörüsün ve spor beslenmesi uzmanısın", "an experienced cycling coach and sports nutritionist"],
  running:  ["deneyimli bir koşu antrenörüsün ve spor beslenmesi uzmanısın",     "an experienced running coach and sports nutritionist"],
  swimming: ["deneyimli bir yüzme antrenörüsün ve spor beslenmesi uzmanısın",    "an experienced swimming coach and sports nutritionist"],
  walking:  ["deneyimli bir yürüyüş ve outdoor antrenörüsün",                    "an experienced hiking and outdoor coach"],
  strength: ["deneyimli bir kuvvet ve kondisyon antrenörüsün ve spor beslenmesi uzmanısın", "an experienced strength and conditioning coach and sports nutritionist"],
  yoga:     ["deneyimli bir yoga eğitmenisin ve wellness uzmanısın",             "an experienced yoga instructor and wellness specialist"],
  water:    ["deneyimli bir su sporları antrenörüsün",                           "an experienced water sports coach"],
  winter:   ["deneyimli bir kış sporları antrenörüsün",                          "an experienced winter sports coach"],
  default:  ["deneyimli bir spor antrenörüsün ve spor beslenmesi uzmanısın",     "an experienced sports coach and sports nutritionist"],
};

export type CoachCard = { title: string; detail: string; severity: "info" | "warning" | "error" };

export type ActivityMetrics = {
  activity_type: string;
  summary:    { duration_seconds: number; moving_seconds: number; started_at: string };
  metrics:    { distance_km: number; avg_speed_kmh: number; max_speed_kmh: number };
  elevation:  { elevation_gain_m: number };
  heart_rate: { hr_avg: number | null; hr_max: number | null };
};

function fmtDur(sec: number | null, lang: string): string {
  if (!sec) return lang === "tr" ? "bilinmiyor" : "unknown";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return lang === "tr" ? `${h}s ${m}dk` : `${h}h ${m}m`;
  return lang === "tr" ? `${m}dk ${s}sn` : `${m}m ${s}s`;
}

const f = (v: number | null | undefined, d = 1) => v != null ? v.toFixed(d) : "—";

function buildPrompt(lang: string, data: ActivityMetrics): string {
  const sportKey = SPORT_MAP[data.activity_type] ?? "default";
  const [tr, en] = SPORT_COACH[sportKey];
  const coach = lang === "tr" ? tr : en;

  const stats = `
Spor türü: ${data.activity_type || "Unknown"}
Mesafe: ${f(data.metrics.distance_km, 2)} km
Toplam süre: ${fmtDur(data.summary.duration_seconds, lang)}
Hareket süresi: ${fmtDur(data.summary.moving_seconds, lang)}
Ort. hız: ${f(data.metrics.avg_speed_kmh)} km/h
Maks. hız: ${f(data.metrics.max_speed_kmh)} km/h
Tırmanış: ${f(data.elevation.elevation_gain_m, 0)} m
Ort. nabız: ${f(data.heart_rate.hr_avg, 0)} bpm
Maks. nabız: ${f(data.heart_rate.hr_max, 0)} bpm
Başlangıç: ${data.summary.started_at}`;

  if (lang === "tr") return `Sen ${coach}. 20 yılı aşkın deneyiminle olimpik sporculara koçluk yaptın. Her öneri bu sporcunun bu antrenmanına özel olsun.

ZORUNLU DİL KURALI: TAMAMEN Türkçe yaz. Sadece Latin alfabe ve Türkçe karakterler (ğ ş ç ö ü ı). Arapça, Hintçe veya başka alfabeden KESİNLİKLE karakter kullanma.

Antrenman verisi:${stats}

YALNIZCA şu JSON formatında yanıt ver:
{"cards":[{"title":"max 5 kelime","detail":"2-4 cümle, sen dili, spesifik sayılar, aksiyonel","severity":"info"}]}

Tam olarak 5 kart, bu sırayla:
1. PERFORMANS — rakamlar, güçlü/zayıf yönler
2. TOPARLANMA — kas özelinde süre, uyku, aktif dinlenme
3. BESLENME & TAKVİYE — 30-45dk pencere, protein/karbonhidrat gram, takviye önerileri
4. TEKNİK & FORM — spor özelinde iyileştirme, biomechanics
5. SONRAKİ ANTRENMAN — mesafe/hız/nabız zonu hedefi ve zamanlama

severity: info=olumlu/nötr, warning=dikkat et, error=ciddi risk. SADECE JSON.`;

  return `You are ${coach}. 20+ years coaching Olympic athletes. Every recommendation specific to THIS athlete's data.

CRITICAL: Respond ONLY in English. ONLY standard Latin characters (a-z A-Z). NO Arabic, Hindi, Persian or non-Latin scripts.

Workout data:${stats}

Return ONLY this JSON format:
{"cards":[{"title":"max 5 words","detail":"2-4 sentences, address athlete directly, cite numbers, be actionable","severity":"info"}]}

Exactly 5 cards in this order:
1. PERFORMANCE — what numbers show, strengths/weaknesses
2. RECOVERY — muscle-specific recovery time, sleep, active rest
3. NUTRITION & SUPPLEMENTS — 30-45min window, protein/carbs grams, supplements
4. TECHNIQUE & FORM — sport-specific improvement, biomechanics
5. NEXT WORKOUT — distance/pace/HR zone target and timing

severity: info=positive/neutral, warning=pay attention, error=serious risk. ONLY JSON.`;
}

function parseCards(raw: string): CoachCard[] {
  let clean = raw.trim();
  if (clean.startsWith("```")) clean = clean.split("\n").slice(1).join("\n");
  if (clean.endsWith("```")) clean = clean.split("\n").slice(0, -1).join("\n");
  const parsed = JSON.parse(clean.trim());
  return Array.isArray(parsed) ? parsed : (parsed.cards ?? []);
}

export async function analyzeActivity(data: ActivityMetrics, lang: string): Promise<CoachCard[]> {
  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1500,
    stream: false,
    messages: [
      {
        role: "system",
        content: lang === "tr"
          ? "Sen bir spor koçusun. SADECE geçerli JSON döndür. Başka metin yazma."
          : "You are a sports coach. Return ONLY valid JSON. No extra text.",
      },
      { role: "user", content: buildPrompt(lang, data) },
    ],
  });
  return parseCards(completion.choices[0].message.content ?? "");
}

export async function translateCards(cards: CoachCard[], lang: string): Promise<CoachCard[]> {
  const target = lang === "tr" ? "Türkçe" : "English";
  const rule   = lang === "tr"
    ? "ZORUNLU: Yanıt YALNIZCA Türkçe. Sadece Latin ve Türkçe karakterler."
    : "CRITICAL: Response ONLY in English. ONLY standard Latin characters.";

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    max_tokens: 1500,
    stream: false,
    messages: [
      { role: "system", content: `You are a professional translator. Return ONLY valid JSON array. No markdown.` },
      { role: "user",   content: `${rule}\n\nTranslate to ${target}. Translate only "title" and "detail". Keep "severity" unchanged. Return ONLY the JSON array.\n\n${JSON.stringify(cards)}` },
    ],
  });

  let clean = (completion.choices[0].message.content ?? "").trim();
  if (clean.startsWith("```")) clean = clean.split("\n").slice(1).join("\n");
  if (clean.endsWith("```")) clean = clean.split("\n").slice(0, -1).join("\n");
  const parsed = JSON.parse(clean.trim());
  return Array.isArray(parsed) ? parsed : (parsed.cards ?? parsed);
}
