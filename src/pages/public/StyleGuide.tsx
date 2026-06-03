import { Link } from "react-router-dom";
import { Masthead } from "@/components/Masthead";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

type Example = {
  slug: string;
  category: string;
  region: string;
  headline: string;
  byline: string;
  date: string;
  lede: string;
  hero: string;
  body: string;
  sources: { title: string; url: string; notes: string[] }[];
};

const EXAMPLES: Example[] = [
  {
    slug: "kakamega-cultural-festival-returns",
    category: "EVENTS · WESTERN KENYA",
    region: "Kakamega",
    headline: "Kakamega Cultural Festival returns to Bukhungu Stadium on November 22 with Sauti Sol headlining",
    byline: "Amaica Newsroom",
    date: "October 4, 2026",
    lede: "The Kakamega Cultural Festival returns to Bukhungu Stadium on Saturday, November 22, with Sauti Sol headlining a 12-act lineup, organisers confirmed Thursday.",
    hero: "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1600&q=80",
    body: `The Kakamega Cultural Festival returns to Bukhungu Stadium on Saturday, November 22, with Sauti Sol headlining a 12-act lineup, organisers confirmed Thursday.\n\nThe one-day festival opens at 2 PM. Early-bird tickets cost KSh 1,500 and regular tickets KSh 2,500, available through the festival's official site and at Naivas Kakamega.\n\n## Background\n\nThe festival ran every November between 2018 and 2023 before pausing for two years over funding gaps. The county government and a private events company, Westside Live, revived it this year under a three-year partnership announced in July.\n\nLast year's edition was cancelled in October 2025 after a sponsor pulled out, leaving an estimated 8,000 ticket-holders to seek refunds. Organisers said this year's revival is "fully funded for the full three-year cycle".\n\n## Key Details\n\nThe lineup features Sauti Sol, Bensoul, Nyashinski, Bungoma-born comedian Mjango, Khaligraph Jones, Nadia Mukami, and six Western Kenya acts including Mejja's Luhya-language collaboration with rapper Breeder LW.\n\nGates open at 1 PM. The main stage runs from 4 PM to 11 PM. Family zones, a food court with 24 vendors, and a crafts market will operate from 2 PM. Bukhungu Stadium holds 22,000 spectators.\n\nMatatu shuttles will run from Kakamega town centre every 15 minutes between 1 PM and midnight at KSh 50 per trip, the county transport office said.\n\n## Quotes\n\n"We are back, and we are back at full strength," said Festival Director Caroline Shisanya. "Sauti Sol's confirmation was the signal that the festival is healthy again — and that Kakamega is on the national music map."\n\nSauti Sol's Bien-Aimé Baraza told Amaica Media the group rescheduled a Mombasa show to make the Kakamega date. "Western Kenya audiences sing every word back at you. That energy is the reason we said yes within a week," he said.\n\n## Why it matters\n\nFor Western Kenya's live-music scene, the festival's return restores the region's biggest single-night audience and the only stadium-scale stage between Nairobi and Kisumu. Local promoters told Amaica Media they expect at least KSh 80 million in direct spend across hotels, transport, and vendors over the festival weekend.\n\nIt also gives six emerging Western Kenya acts a 22,000-seat platform — the kind of exposure that has historically been confined to Nairobi venues.\n\n## Outlook\n\nTickets go on sale at 10 AM on Monday, October 7, through kakamegafest.co.ke and Naivas outlets in Kakamega, Kisumu, and Bungoma. The full schedule will be published on November 1. Organisers said a second 2026 edition is planned for March, with a four-act preview show at Muliro Gardens on November 21.`,
    sources: [
      { title: "Kakamega County press briefing, Oct 3 2026", url: "https://example.org/kakamega/festival-2026", notes: ["Festival date: Saturday, November 22", "Venue: Bukhungu Stadium, capacity 22,000", "Ticket prices: KSh 1,500 early, KSh 2,500 regular", "12 acts confirmed, Sauti Sol headlining"] },
      { title: "Westside Live statement", url: "https://example.org/westside-live/funding", notes: ["Three-year funding partnership with Kakamega County", "Confirmed financing for 2026–2028 editions"] },
      { title: "Amaica Media interview, Bien-Aimé Baraza", url: "https://example.org/amaica/sauti-sol-interview", notes: ["Sauti Sol moved a Mombasa show to fit the Kakamega date", "Quote on Western Kenya audiences"] },
    ],
  },
  {
    slug: "jahmby-koikai-foundation-kisumu",
    category: "CELEBRITY · KENYA",
    region: "Kisumu",
    headline: "Walt Mzengi opens free music school in Kisumu, says first 60 students start in January",
    byline: "Amaica Newsroom",
    date: "October 1, 2026",
    lede: "Producer Walt Mzengi opened a free music school in Kisumu's Milimani estate on Tuesday, with the first 60 students set to begin classes in January, his foundation said.",
    hero: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1600&q=80",
    body: `Producer Walt Mzengi opened a free music school in Kisumu's Milimani estate on Tuesday, with the first 60 students set to begin classes in January, his foundation said.\n\nThe Walt Music Foundation school will offer two-year diplomas in production, audio engineering, vocal performance, and music business. Tuition is fully funded for students aged 14 to 22 from Kisumu, Siaya, Homa Bay, and Migori counties.\n\n## Background\n\nMzengi grew up in Kisumu before moving to Nairobi in 2014 and producing for Sauti Sol, Bensoul, and Nyashinski. He has spoken publicly since 2023 about the lack of formal music training in lakeside counties, where most aspiring producers travel to Nairobi at their own cost.\n\nIn April 2025 his foundation bought the former Milimani Primary annex for KSh 42 million and spent 14 months converting it into three studios, a 120-seat performance hall, and 12 classrooms.\n\n## Key Details\n\nThe school sits on a 0.8-acre plot off Achieng Oneko Road. It opens with three full-time staff and 11 visiting tutors, including engineer Cedo and vocal coach Suzanna Owiyo.\n\nApplications opened Wednesday at waltmusicfoundation.org. The first intake closes November 15. Mzengi said 1,200 applications had already arrived by Tuesday evening.\n\nThe foundation has committed KSh 28 million per year for operations through 2030, funded by Mzengi's production royalties and a partnership with Safaricom Foundation announced in August.\n\n## Quotes\n\n"I never want a 17-year-old from Homa Bay to feel that music is a Nairobi-only career," Mzengi said at the launch. "Everything I learned the hard way is now in this building, for free."\n\nKisumu Governor Anyang' Nyong'o, who cut the ribbon, told Amaica Media the county would gazette the school as a recognised technical training institution before December. "This is the first time a producer of this calibre is rooting his investment in the lake region," he said.\n\n## Why it matters\n\nFor lake-region teenagers, the school removes two of the biggest barriers to music careers: cost and relocation. Industry estimates put a private two-year production course in Nairobi at KSh 480,000 to KSh 720,000, before living costs.\n\nIt also gives Kisumu a permanent production-grade studio for the first time since 2019, which local artists said had pushed them to record demos in cyber cafés or travel to Nairobi every six weeks.\n\n## Outlook\n\nThe foundation will publish the shortlist on December 5 and announce the 60-student first cohort on December 20. Classes start Monday, January 12. Mzengi said a satellite campus in Kakamega is "next on the list" if the Kisumu cohort hits its retention targets in 2027.`,
    sources: [
      { title: "Walt Music Foundation launch statement", url: "https://example.org/waltmusicfoundation/launch", notes: ["Opening date: Tuesday, September 30, 2026", "60-student first cohort starts January 12, 2027", "Diplomas: production, engineering, vocal performance, music business"] },
      { title: "Kisumu County governor's office", url: "https://example.org/kisumu/governor-statement", notes: ["County to gazette the school as a recognised TVET institution before December", "Quote from Governor Nyong'o"] },
      { title: "Safaricom Foundation partnership release, Aug 2026", url: "https://example.org/safaricomfoundation/walt-music", notes: ["Funding partnership through 2030", "KSh 28M annual operating commitment"] },
    ],
  },
  {
    slug: "bungoma-film-festival-review",
    category: "FILM · WESTERN KENYA",
    region: "Bungoma",
    headline: "Bungoma Film Festival's second edition proves the lakeside circuit can host serious cinema",
    byline: "Amaica Newsroom",
    date: "September 28, 2026",
    lede: "The second Bungoma Film Festival closed Sunday with a tighter programme, stronger Kenyan competition, and a verdict: Western Kenya can host serious cinema without leaning on Nairobi.",
    hero: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1600&q=80",
    body: `The second Bungoma Film Festival closed Sunday with a tighter programme, stronger Kenyan competition, and a verdict: Western Kenya can host serious cinema without leaning on Nairobi.\n\nThe four-day festival screened 38 films at Bungoma Sports Club and Kanduyi Social Hall between September 24 and 27, drawing about 6,400 ticketed attendees, organisers said.\n\n## Background\n\nThe festival launched in 2025 with 18 films and roughly 2,100 attendees, mostly drawn from Bungoma town. Critics at the time questioned whether the region had the infrastructure or audience to sustain a film festival outside Nairobi or Mombasa.\n\nThis year's programme tripled in size, added a competitive section judged by a three-person jury, and introduced a KSh 500,000 best-feature prize backed by the Bungoma County department of culture.\n\n## Key Details\n\nThe top prize went to "Mlima", a 96-minute drama set in Mt Elgon directed by first-time filmmaker Asha Wafula. Best documentary went to "The Loom", a 52-minute portrait of weavers in Webuye, directed by Joash Wanyama.\n\nTicket prices ran from KSh 200 for single screenings to KSh 1,200 for a festival pass. Twelve screenings sold out, including all three showings of "Mlima".\n\nSeven of the 38 films were directed by Western Kenya filmmakers, up from two in 2025.\n\n## Quotes\n\n"The audience never let a film breathe in silence — they laughed, they argued, they stayed for the Q&A," said festival director Brian Wekesa. "That tells us the appetite is there. Now we need the infrastructure."\n\nWafula, accepting the best-feature prize, told Amaica Media she shot "Mlima" for KSh 1.8 million over 22 days in Cheptais. "Every cast member is from Mt Elgon. Every location is real. I refused to fake the region," she said.\n\n## Why it matters\n\nFor Western Kenya filmmakers, the festival creates the region's first competitive showcase with a meaningful cash prize. Until now, lakeside directors have had to enter their films into Nairobi or Kampala festivals, often at submission fees of US$30 to US$70 per title.\n\nThe attendance jump also signals to distributors that the lakeside circuit can sell tickets at scale, which festival sponsors said had been the single biggest hesitation in 2025.\n\n## Outlook\n\nThe third edition is scheduled for September 23–27, 2027. Submissions open March 1 and close June 15. Wekesa said the festival is in talks with Kenya Cinema and Anga Sky Cinema about year-round screenings of Western Kenya films at venues in Kisumu and Eldoret, with a pilot screening of "Mlima" planned for November.`,
    sources: [
      { title: "Bungoma Film Festival closing-night press release", url: "https://example.org/bungomafilmfest/closing-2026", notes: ["38 films screened across 4 days", "Attendance: ~6,400", "Best feature: ‘Mlima’ by Asha Wafula", "Best documentary: ‘The Loom’ by Joash Wanyama"] },
      { title: "Bungoma County culture department", url: "https://example.org/bungoma/culture-dept", notes: ["KSh 500,000 best-feature prize funded by the county", "Festival ran Sept 24–27 at Bungoma Sports Club and Kanduyi Social Hall"] },
      { title: "Amaica Media interview, Asha Wafula", url: "https://example.org/amaica/wafula-interview", notes: ["Budget: KSh 1.8M, shot in 22 days", "Cast and locations entirely in Cheptais, Mt Elgon"] },
    ],
  },
];

const CHECKLIST = [
  "Lede answers ‘what happened?’ in one sentence (18–22 words).",
  "All five mandatory headings present in order: Background · Key Details · Quotes · Why it matters · Outlook.",
  "Minimum six paragraphs; word count hits the template target.",
  "At least two attributed direct quotes — every quote ends with said/told/confirmed + a named person.",
  "Specific places, dates, prices (KSh), and venues throughout.",
  "Sources panel lists every link used, with 2–4 short extracted notes per source.",
  "No hype words (amazing, incredible, stunning, slayed, shook, absolutely).",
  "Forward-looking close: what's next, when, where.",
];

export default function StyleGuide() {
  return (
    <div className="min-h-screen bg-background">
      <Masthead variant="public" />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Link to="/" className="inline-flex items-center gap-1 text-xs text-ink-light hover:text-primary mb-6">
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="label-eyebrow text-primary mb-3">Newsroom · Style guide</div>
        <h1 className="font-display text-4xl md:text-5xl leading-[1.1] mb-4">Amaica Media house style</h1>
        <p className="text-lg text-ink-mid leading-relaxed mb-8 font-light">
          The structured template every story must follow, with three reference articles — a Kakamega event,
          a Walt Mzengi profile-news piece, and a Bungoma film-festival review — that meet every requirement.
        </p>

        <section className="bg-card border border-border rounded p-5 mb-10 shadow-card">
          <h2 className="font-display text-2xl mb-3">The approval checklist</h2>
          <ul className="space-y-2">
            {CHECKLIST.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-ink-mid">
                <CheckCircle2 size={14} className="text-primary mt-1 flex-shrink-0" /> {c}
              </li>
            ))}
          </ul>
        </section>

        <h2 className="font-display text-3xl mb-1">Reference articles</h2>
        <p className="text-sm text-ink-light mb-8">Each example below would pass every automated check before approval.</p>

        {EXAMPLES.map((ex) => (
          <article key={ex.slug} className="mb-16 pb-12 border-b border-border last:border-b-0">
            <div className="label-eyebrow text-primary mb-3">{ex.category}</div>
            <h3 className="font-display text-3xl leading-tight mb-3">{ex.headline}</h3>
            <p className="text-lg text-ink-mid leading-relaxed mb-4 font-light">{ex.lede}</p>
            <div className="flex items-center gap-3 pb-5 mb-6 border-b border-border text-[11px] font-mono uppercase tracking-wider text-ink-light">
              <span>By {ex.byline}</span><span>·</span><span>{ex.date}</span><span>·</span><span>{ex.region}</span>
            </div>
            <img src={ex.hero} alt="" className="w-full aspect-[16/9] object-cover rounded mb-6" />
            <div className="text-ink-mid">
              {ex.body.split(/\n\n+/).map((p, i) => {
                const h = p.trim().match(/^(#{2,3})\s+(.+)$/);
                if (h) return <h4 key={i} className="font-display text-2xl mt-6 mb-2 text-foreground">{h[2]}</h4>;
                return <p key={i} className="mb-4 leading-relaxed text-[16px]">{p.trim()}</p>;
              })}
            </div>
            <section className="mt-8 pt-5 border-t border-border">
              <div className="label-eyebrow text-primary mb-3">Sources & verification notes</div>
              <ul className="space-y-3">
                {ex.sources.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium">{s.title}</span>
                    <ul className="mt-1 pl-4 list-disc text-xs text-ink-light space-y-0.5">
                      {s.notes.map((n, j) => <li key={j}>{n}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          </article>
        ))}
      </main>
    </div>
  );
}