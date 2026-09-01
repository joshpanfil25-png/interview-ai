import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Two model calls now run per request (generate + quality-gate), so give the
// function headroom beyond the platform default to avoid edge-case timeouts.
export const maxDuration = 60

// Verticals that are school admissions interviews, not job interviews.
// "company" is read as the target school; "role" is read as the program/degree.
// Narrowed to business verticals only (2026 platform-focus overhaul) — keep in
// sync with SCHOOL_VERTICALS in app/get-started/page.tsx.
const SCHOOL_VERTICALS = new Set([
  'Business School / MBA',
])

// Known firm interview-style calibration. Applied only when the entered company
// clearly matches a known firm (word-boundary match on an alias) — we never
// fabricate firm-specific detail for an unknown company; unmatched companies just
// fall back to the vertical guidance, with no calibration line added.
const COMPANY_CALIBRATION: Array<{ aliases: string[]; note: string }> = [
  {
    aliases: ['mckinsey'],
    note: 'McKinsey scores a Personal Experience Interview (PEI) separately from the case, around leadership, personal impact, and entrepreneurial drive — favor one deep story per theme over breadth. Cases are interviewer-led, so expect the interviewer to steer mid-case.',
  },
  {
    aliases: ['bcg', 'boston consulting'],
    note: 'BCG cases are more candidate-led than McKinsey — the candidate should drive the structure and pacing. Later rounds often include a written or data-interpretation case, so comfort reading exhibits quickly matters.',
  },
  {
    aliases: ['bain'],
    note: 'Bain weights culture fit unusually high — the "would I enjoy a long week with this person" test — so reward genuine warmth alongside competence. Its cases layer business judgment on top of the math, so a mechanically correct answer that ignores commercial reality gets pushed on.',
  },
  {
    aliases: ['amazon', 'aws'],
    note: 'Amazon maps nearly every behavioral question to a Leadership Principle (Customer Obsession, Ownership, Bias for Action, Dive Deep, Disagree and Commit, Deliver Results). Expect very deep, repeated follow-ups on a single story — depth over breadth.',
  },
  {
    aliases: ['google', 'alphabet'],
    note: 'Google scores behavioral answers on general cognitive ability and "Googleyness" as much as the specific answer, so structure and self-awareness matter. In technical rounds, collaborative communication is graded alongside correctness.',
  },
  {
    aliases: ['meta', 'facebook', 'instagram'],
    note: 'Meta behavioral centers on a few signals — drive and impact, working with others, and resolving conflict — with direct "tell me about a time" drilling on the candidate’s specific role in a team outcome. Technical rounds move fast.',
  },
  {
    aliases: ['microsoft'],
    note: 'Microsoft leans on growth mindset and collaboration — a real failure and what was learned lands well. Rounds often blend technical and behavioral in one conversation, and "why this team" genuinely matters.',
  },
  {
    aliases: ['deloitte', 'pwc', 'pricewaterhouse', 'kpmg', 'ernst', 'ey'],
    note: 'At a Big 4 firm the pivotal question is genuinely "why our firm over the other three" — a generic answer is transparent, so anchor on one specific, verifiable reason. Interviews are competency/behavioral-based and weight fit, coachability, and detail-orientation heavily.',
  },
  {
    aliases: ['goldman', 'jpmorgan', 'jp morgan', 'morgan stanley', 'citi', 'citibank', 'citigroup', 'bank of america', 'bofa', 'barclays'],
    note: 'At a bulge-bracket bank, fit interviews hammer "why banking," "why this bank," and a deal or markets story the candidate can speak to. Expect the same core questions across many back-to-back superday interviewers, so a consistent, non-robotic core narrative matters.',
  },
  {
    aliases: ['evercore', 'lazard', 'centerview', 'moelis', 'pjt'],
    note: 'At an elite advisory boutique, fit interviews go deep on genuine interest in advisory work, a specific deal or the firm’s model, and strong technicals, in a smaller and more personal process where fit and polish weigh heavily.',
  },
  {
    aliases: ['apple'],
    note: 'Apple interviews emphasize deep functional expertise, craft and attention to detail, and cross-functional collaboration in a secrecy-conscious culture — expect substantive depth in the candidate’s actual domain over broad "why tech" prompts.',
  },
  {
    aliases: ['netflix'],
    note: 'Netflix screens hard against its culture — freedom and responsibility, a high-performance bar, and candid feedback — so expect direct questions about judgment, ownership, and giving or receiving candor, calibrated to a senior bar.',
  },
  {
    aliases: ['stripe'],
    note: 'Stripe values rigorous first-principles problem-solving, user empathy, and unusually clear written and verbal reasoning — expect practical, real-world problems and a high bar on communication.',
  },
  {
    aliases: ['tesla', 'spacex'],
    note: 'Tesla and SpaceX run fast, intense interviews that probe hands-on, first-principles engineering on real projects and a high tolerance for pace and pressure — expect specific technical depth and evidence of ownership over polish.',
  },
  {
    aliases: ['accenture'],
    note: 'Accenture uses competency-based interviews and, for many roles, a case or group exercise — expect a specific "why Accenture," teamwork, and client-delivery scenarios over pure technical trivia.',
  },
  {
    aliases: ['teach for america', 'tfa'],
    note: 'Teach For America’s process centers on a sample teaching lesson and a group activity alongside the interview, and screens for a demonstrated record of achievement, perseverance, and commitment to educational equity — concrete examples over idealism.',
  },
]

// Returns the calibration note for a known firm, or null. Matches an alias only
// on a word boundary so short aliases (e.g. "ey") do not match inside other words.
function matchCompanyCalibration(company: string): string | null {
  for (const entry of COMPANY_CALIBRATION) {
    for (const alias of entry.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(company)) return entry.note
    }
  }
  return null
}

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'] as const
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]

// ─────────────────────────────────────────────────────────────────────────
// 2026 overhaul: narrowed to business verticals, question generation rebuilt
// around expert (Bryce Burnworth / Highspring, Scott / Accenture, Muge Tuna /
// IU) and student feedback. Every kept vertical now gets a fixed 6-question
// arc (see FIXED_ARC_ORDER below) instead of a variable behavioral/technical
// mix — there is no dedicated case/technical-depth slot anymore. Each entry
// here names the 1-2 real intangibles the two short behavioral questions
// (Q4-Q5) should probe for this field, grounded in a concrete, recognizable
// situation type — never a generic prompt with the field name swapped in —
// plus a touch of domain flavor for the curveball. Coffee Chat and
// Startup / Founder / VC keep their own bespoke arcs (see arcOverrides) since
// they are not standard STAR interviews; their guidance text below still
// gets injected as context.
// ─────────────────────────────────────────────────────────────────────────
const verticalGuidance: Record<string, string> = {
  'Finance':
    'Finance spans distinct sub-fields — corporate finance/FP&A, buy-side investing, and markets — so calibrate to the stated role rather than treating it as one thing. Ground the two short behavioral questions in real judgment intangibles: initiative (a time they researched, modeled, or formed a point of view on something no one assigned them) and handling being wrong (a time a recommendation, forecast, or read on a number didn’t hold up, and what they did next). Keep them short — do not ask for a walkthrough of a model or a stock pitch; that belongs to a technical round, not this behavioral set. The curveball should be a short scenario about defending an assumption or a number under real-time pushback. (Investment Banking and Private Equity have their own verticals.)',
  'Investment Banking':
    'IB screens for composure, ownership, and precision under real deadline and hierarchy pressure — not memorized deal steps. Ground the two short behavioral questions in initiative (catching or fixing a mistake in a deliverable before it went out, without being told to check) and handling being corrected (a senior person or professor pushed back hard on their work under time pressure — how they responded). Do not ask for a DCF or LBO walkthrough here; that belongs to a technical round. The curveball should be a short, realistic overnight-turnaround scenario that tests judgment about what to prioritize with incomplete information.',
  'Private Equity':
    'PE screens for independent judgment and intellectual honesty about a thesis, not memorized returns math. Ground the two short behavioral questions in initiative (digging into a company, industry, or idea on their own, without being asked) and handling being wrong (a time their initial read on something didn’t hold up under more information, and how they adjusted). Do not ask for MOIC/IRR mechanics or a case-style target evaluation here; that belongs to a technical round. The curveball should be a short scenario about advocating for or against a call with limited time to diligence it.',
  'Actuarial / Quant':
    'This covers actuarial and quantitative-finance roles. Ground the two short behavioral questions in initiative (teaching themselves something technical — an exam topic, a tool, a concept — before anyone required it) and handling being wrong (catching or being caught in a calculation or estimate that was off, and what they did about it). Do not ask a probability brainteaser or Fermi estimate as a standalone technical slot; if a quick-estimation flavor fits, fold it into the curveball as a short, real-time judgment scenario rather than a puzzle to solve for its own sake. For actuarial candidates, exam progress (SOA/CAS) is fair context, not the question itself.',
  'Consulting':
    'Consulting screens for structured thinking and judgment shown through real behavior — not case-cracking. Cases and behavioral interviews are separate interview types; do not construct a case, a live framework-building exercise, or a market-sizing prompt here. Ground the two short behavioral questions in what actually separates a strong entry-level consultant: taking ownership of a piece of ambiguous team or project work that no one clearly assigned to them, or a moment a manager, professor, or teammate pushed back on their approach and how they responded. The curveball should be a short, scenario-based judgment/resourcefulness prompt — never a market-sizing or estimation puzzle.',
  'Accounting':
    'Accounting rewards precision, ownership, and honesty about numbers — not platitudes about "being detail-oriented." Ground the two short behavioral questions in a concrete moment of catching or owning up to an error under deadline pressure, and a moment of taking initiative on a reconciliation, close, or process issue no one assigned them. The curveball should be a short scenario testing composure and integrity under a deadline crunch — for example, discovering a discrepancy the night before a close.',
  'Audit':
    'Audit screens for professional skepticism and integrity, especially under client-relationship pressure. Ground the two short behavioral questions in initiative (flagging or digging into something that didn’t look right when it would have been easier to let it go) and handling pushback (a client, manager, or peer resisted a concern they raised, and how they held their ground appropriately). The curveball should be a short scenario about a client nudging toward a favorable interpretation and what they’d do next.',
  'Real Estate':
    'Ground the two short behavioral questions in initiative (researching or underwriting something no one asked them to look into) and handling being wrong (an assumption or read on a deal, comp, or market that didn’t hold up, and what they did next). Do not ask for cap-rate or NOI mechanics here; that belongs to a technical round. The curveball should be a short scenario — a number in a model doesn’t check out the day before a pitch, what do they do.',
  'Marketing':
    'Marketing spans performance/growth, brand, and partnership/sponsorship models — infer which one actually dominates for this specific role and company, and let the metrics vocabulary in the questions match it. Ground the two short behavioral questions in initiative (testing or proposing something no one asked for) and handling an idea or campaign that didn’t have the impact they expected — a genuine, unflattering result and what they learned. The curveball should be a short scenario about a campaign underperforming right before a big review.',
  'Sales':
    'Ground the two short behavioral questions in initiative (self-sourcing or pursuing an opportunity no one handed them) and resilience (a real rejection or a deal that fell through, and what they took from it — not "I stayed positive"). The curveball should be a short, real scenario — a prospect goes cold or a champion pushes back the day before a close — asking what they would actually do next, not a full role-play script.',
  'Customer Success':
    'Ground the two short behavioral questions in initiative (catching or fixing a customer issue before it escalated, without being asked) and handling being wrong (a time they misread what a customer actually needed and had to correct course). The curveball should be a short, real scenario — an at-risk account or an angry customer moment — asking what they would do next.',
  'Human Resources':
    'Ground the two short behavioral questions in initiative (quietly noticing and raising a process gap or a colleague struggling before being asked) and handling being wrong (a time they misread a people situation and had to adjust). Never ask an entry-level or intern candidate to describe independently resolving a real employee-relations matter alone — frame any people-scenario around judgment and knowing who to loop in, not solo resolution. The curveball should be a short scenario testing that same judgment: a sensitive situation where the right move is knowing what to escalate and to whom.',
  'Operations':
    'Ground the two short behavioral questions in initiative (fixing or improving a broken process no one assigned them to touch) and handling being wrong (a fix or assumption that didn’t pan out, and what they did next). The curveball should be a short scenario — something breaks the day of a hard deadline — testing prioritization and judgment under real constraints, not a full root-cause methodology recitation.',
  'Product Management':
    'Ground the two short behavioral questions in initiative (pushing on a question or idea no one asked them to investigate) and a decision, feature, or idea that didn’t have the impact they expected — a genuine miss and what they learned. Do not ask a product-design or metrics-estimation prompt here; that belongs to a technical round. The curveball should be a short scenario about conflicting stakeholder requests forcing a real prioritization call.',
  'Project / Program Management':
    'This is delivery/execution management, not product management. Ground the two short behavioral questions in initiative (unblocking or catching a stalled piece of work no one assigned them to fix) and handling being wrong (a plan, estimate, or timeline that didn’t hold up, and how they adjusted). The curveball should be a short scenario about a slipping deadline and a real judgment call on who to loop in and what to cut.',
  'Business School / MBA':
    'This is an MBA admissions interview, not a job interview — the candidate is applying to this business school for their MBA. Ground the two short behavioral questions in initiative (leading or driving something that was not formally assigned to them) and handling being wrong (a time a peer, mentor, or manager corrected their thinking, and how they responded). The curveball should be a short scenario about adapting when a plan or team situation changed unexpectedly.',
  'Startup / Founder / VC':
    'These are rapid, two-way evaluative conversations (a YC-style interview is roughly ten minutes of fast, specific back-and-forth), not a behavioral STAR interview — so do NOT use the standard behavioral arc here. Replace the four behavioral questions with fast, concrete, startup-specific questions: what are you building and who is it for; how do you know they actually want it (real evidence of demand, with numbers — users, revenue, growth, or specific customer conversations); why you and your team specifically; and what you have learned recently that changed your plan. Each should be answerable in a sentence or two with real specifics, rewarding concrete numbers and honesty over pitch-mode hand-waving. The role-specific question should probe founder-market fit, the single biggest real risk, or unit economics and equity/commitment precision. The curveball should be a real founder scenario (for example, a well-funded incumbent ships your exact feature next week — what do you do in the next thirty days). Expect the candidate to ask sharp questions back.',
  'Coffee Chat':
    'This is an informal networking conversation, not a formal interview. Replace the behavioral questions with 4 natural conversation-starter questions (career journey, advice, industry trends, day-to-day experience). Replace the role-specific question with a thoughtful question about their path. The curveball should be a memorable, genuine question that shows curiosity. Keep all questions open-ended and conversational.',
  'General':
    'Use broadly applicable behavioral questions suitable for any business role. Ground the two short behavioral questions in initiative (a time they took on something no one asked them to) and handling being wrong (a time they were corrected or a plan didn’t work out, and what they did next), using whatever specific detail is available about the role, company, or resume to keep them concrete rather than generic.',
}

// ─────────────────────────────────────────────────────────────────────────
// Dormant — narrowed out of the platform in the 2026 business-verticals
// overhaul (see INTERVIEW_TYPES in app/get-started/page.tsx). NOT read
// anywhere below; kept verbatim (pre-overhaul wording, including the old
// case/technical-slot framing) so this guidance work isn't lost if we
// re-expand scope. To restore a vertical: move its entry back into
// verticalGuidance above, re-add its name to INTERVIEW_TYPES in
// app/get-started/page.tsx, and re-add it to SCHOOL_VERTICALS in both files
// if applicable — then decide whether it should use the new fixed 6-question
// arc or needs its own guidance update to match.
// ─────────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- intentionally dormant, see comment above
const DORMANT_VERTICAL_GUIDANCE: Record<string, string> = {
  'Tech':
    'Calibrate to the actual tech role — software engineering, data, product, or infrastructure — rather than "tech" in general. The role-specific question should be a concrete, level-appropriate problem the candidate reasons through out loud — a design or debugging scenario, a build-vs-buy or scaling trade-off, or a "how would you approach X" prompt — rewarding clarifying questions first, an explicit approach before the answer, and stated trade-offs and complexity over a memorized fact. Also probe cross-functional judgment: working with product and design, or handling a technical disagreement. Avoid a generic "tell me about a technology you like" prompt; for a pure coding or algorithms screen, push a layer deeper into the actual data-structure or system-design problem.',
  'Healthcare':
    'Calibrate to the stated healthcare role — clinical, administrative, or health-tech — rather than "healthcare" in general. The role-specific question should be a concrete scenario that surfaces judgment and a patient-safety-first instinct: prioritizing among competing demands, responding to a deteriorating situation or an error, or safely raising a concern up the chain — rewarding a structured approach and honest escalation over "I care about patients." For clinical roles, reward structured handoff communication (for example, SBAR) and interdisciplinary teamwork; for administrative or health-tech roles, ground it in the operational or compliance reality of the job. Avoid a generic "why healthcare" prompt.',
  'Nonprofit':
    'Ground the role-specific question in a concrete resource-constraint or stakeholder scenario — a key donor withdrawing support mid-project, funding for a program getting cut unexpectedly, or an ethical tension between what a donor wants funded and what the program actually needs. Push for both quantitative and qualitative impact measurement (not just "we track outcomes" — ask how they would actually measure success with limited data) and how they would build trust with a community stakeholder who does not yet trust the organization. Avoid a generic "why do you care about this cause" prompt — root it in a specific trade-off.',
  'Government':
    'This is closer to a competency-based interview (UK Civil Service Success Profiles or US federal structured interviews) than a private-sector one — every question should map to a named competency and expect a strict STAR answer where the candidate’s individual action is distinguishable from the team’s. Cover a balance of competencies including at least one cognitive/analytic one: a substantive policy-analysis question (frame a problem, weigh options and trade-offs, state the evidence needed, and give a defensible recommendation with its uncertainty) and a suitability/integrity probe (being trusted with sensitive or confidential information and how it was safeguarded), alongside stakeholder management and communicating with non-expert audiences. The role-specific question should be a realistic policy or constituent-service judgment scenario within institutional constraints — never a partisan policy-opinion question.',
  'Software Engineering':
    'Focus on problem-solving process, communication while coding, and system-design judgment. The role-specific question should present a concrete coding or system-design problem calibrated to the level (e.g. a data-structure/algorithm prompt, or "design a URL shortener") and reward the candidate narrating clarifying questions, a brute-force-then-optimize approach, hand-testing an edge case, and stated time/space trade-offs — not silent recall of a memorized solution.',
  'Engineering (Non-Software)':
    'This covers non-software engineering — mechanical, electrical, civil, chemical, industrial, or aerospace — so calibrate to the discipline named in the role. The role-specific question should make the candidate reason from first principles rather than recite formulas: a technical project walkthrough (problem → constraints and requirements → approach → trade-offs → result, with real numbers), a back-of-the-envelope estimate, or a discipline-specific fundamentals scenario (for example statics/thermodynamics/fluids for mechanical, circuits/power/controls for electrical, structural or geotechnical for civil, mass and energy balances for chemical). Reward safety awareness, real numbers, and clear trade-off reasoning; a design or troubleshooting scenario beats a "define X" prompt. (For software or CS roles, use the Software Engineering or Tech verticals.)',
  'Medical Residency / Fellowship':
    'This is a residency or fellowship interview (the Match) — the candidate is a medical student or physician applying to train in a specific specialty at a specific program, not applying to medical school (use the Pre-Med vertical for school admissions). Ground questions in what residency interviews actually test: a specific, credible reason for choosing THIS specialty (not "why medicine," which they answered years ago), genuine "why this program" fit tied to concrete features (patient population, county vs. academic setting, autonomy and call structure, fellowship and research pathways, location), and clinical judgment under real responsibility. The four behavioral questions should center on maturity in the clinical trenches — disclosing or recovering from a medical error, managing a difficult or non-adherent patient, resolving conflict within the care team or hierarchy (including respectfully disagreeing with an attending), and sustaining performance under fatigue and high patient volume — and may touch research or academic-vs-community trajectory. The role-specific question should be a "why this specialty and this program" fit question or a clinical situational-judgment vignette (a deteriorating patient, a nurse questioning your order, a disagreement over a plan) — judgment and communication, never a knowledge quiz. Keep the curveball fair and self-aware (for example, "what would your co-residents say is hardest about working with you?").',
  'Architecture / Urban Planning':
    'This covers architecture, landscape architecture, and urban-planning roles and their degree programs. The role-specific question should center on a design or project walkthrough — a real project from site constraints and client or community needs through concept, key trade-offs (cost, code, sustainability, buildability), and outcome — or a design-thinking prompt about approaching a specific site or brief. Expect a portfolio to anchor the conversation; reward design judgment, how the candidate balances aesthetics against real constraints and stakeholders, and clear communication of intent over jargon. For licensed roles, the AXP and ARE licensure path is fair to reference.',
  'Fine & Performing Arts':
    'This covers fine art, music, theater, dance, film, and design-arts candidates — for auditions and portfolio reviews (conservatory/BFA/MFA admissions) and for arts-organization or creative jobs. The role-specific question should invite the candidate to walk through a specific piece, performance, or portfolio project — the intent, the process and choices, and what they would change — or, for performers, how they prepare and handle a performance going wrong. Reward a genuine artistic point of view, disciplined process, resilience to critique and rejection, and collaboration over a generic "why art." For arts-administration roles, ground the role-specific question in audience development, programming, or fundraising realities.',
  'Environmental & Sustainability':
    'This covers environmental science, sustainability, conservation, energy, and agriculture roles. The role-specific question should be a concrete applied scenario — designing or evaluating a sustainability initiative under real budget and stakeholder constraints, interpreting environmental data into a recommendation, or balancing environmental goals against economic and regulatory realities — rewarding evidence-based reasoning, systems thinking, and pragmatism over idealism. Probe working with skeptical or competing stakeholders (industry, community, regulators) and measuring real impact rather than intentions.',
  'Criminal Justice / Law Enforcement':
    'This covers police, federal law-enforcement, corrections, and criminal-justice roles, often assessed through a structured oral board. The role-specific question should be a realistic judgment or ethics scenario within legal and procedural constraints — using discretion, de-escalation, responding to a fellow officer doing something wrong (integrity), or a community-trust situation — rewarding sound judgment, composure, ethics, and communication over bravado, and never a partisan or "tough on crime" opinion prompt. The behavioral questions should probe integrity, handling stress and authority, teamwork, and genuine motivation for public safety; expect background and suitability scrutiny.',
  'Hospitality & Culinary Management':
    'This covers hotel, restaurant, event, and culinary MANAGEMENT roles (distinct from entry-level service work, which is the Retail / Hospitality vertical). The role-specific question should be an operations-and-guest scenario — recovering a major service failure for a VIP or a group, handling a health/safety or staffing crisis during a rush, or balancing guest experience against cost and labor — rewarding a calm service-recovery instinct, P&L and labor awareness, and leading a front-line team under pressure. Probe leading hourly staff, handling a difficult guest or a high-stakes event, and a genuine hospitality mindset.',
  'Data / Analytics':
    'Focus on hypothesis-driven analytical reasoning and clear communication of ambiguity. The role-specific question should be a concrete analytics scenario or a conceptual SQL/statistics question — e.g. "how would you investigate a 15% drop in a key metric", "when would you trust or distrust an A/B test result", or how to turn a vague business question into an analysis — rewarding structured reasoning and explicit assumptions over recall of formulas.',
  'Design (UX / Product)':
    'This role centers on the candidate’s reasoning, not pixels. The role-specific question should be a design-challenge or critique prompt (e.g. "design a scheduling app for busy parents", or "critique the onboarding of a product you use") that pushes the candidate to clarify the user and constraints, walk through their process and key trade-offs, and justify decisions with real user needs — never a question that rewards visual polish over thinking.',
  'Cybersecurity':
    'Focus on a systematic security mindset over trivia. The role-specific question should be a concrete scenario — how the candidate would secure a given system, walk through responding to a suspected breach, or threat-model a new feature — grounded in real fundamentals (least privilege, the CIA triad, common OWASP-style vulnerabilities) and a clear detect → triage → contain → remediate → prevent instinct, not memorized definitions.',
  'Media / Journalism / PR':
    'Focus on news/message judgment, writing clarity, and composure under deadline. The role-specific question should be grounded in a concrete scenario — pitch a story and defend why it is newsworthy, handle a correction or a sourcing-ethics dilemma, or manage a reputational crisis (get the facts, identify stakeholders, craft a clear honest message, choose the channel) — rewarding sharp editorial judgment and ethics over buzzwords.',
  'Law / Legal':
    'This is a legal-employment interview (law firm, in-house, clerkship, or a 1L/2L summer-associate OCI), not law-school admissions. The role-specific question should probe legal judgment and professional responsibility through a concrete situation — an ambiguous client problem with incomplete facts, or a genuine ethics/confidentiality dilemma (a client confidence, a conflict of interest, discovering an error in already-filed work, or a peer cutting corners) — and it should be paired with a specific, non-generic "why this firm and practice area" that demands real differentiation from other firms rather than being an afterthought. For students and early-career candidates, explicitly allow examples from law school, a journal, a clinic, undergrad, or prior work, not just legal jobs. Reward structured reasoning and professional judgment; do not quiz black-letter law.',
  'Nursing':
    'This is a clinical-nursing job interview. The role-specific question should be a patient-care scenario testing clinical judgment and safety — prioritizing among several patients (most-unstable-first / ABCs), responding to a deteriorating patient, handling a medication error, or safely escalating a disagreement over an unsafe order — and it should push beyond triage to the actual safety actions: how the candidate would delegate to a tech or charge nurse rather than doing everything alone, and exactly what they would say when they escalate, structured as SBAR (Situation, Background, Assessment, Recommendation). At least one behavioral question should probe honest self-awareness of a current weakness or worry as a new nurse. Reward a patient-safety-first instinct and clear chain-of-command escalation over a generic "I am compassionate."',
  'Teaching / Education':
    'This is a K-12 teaching interview. The role-specific question should be a concrete classroom scenario — a disruptive student, differentiating a lesson for varied levels, a difficult parent conversation, or how the candidate would structure a specific lesson (objective, hook, guided and independent practice, a check for understanding) — rewarding concrete, student-centered moves and assessment/data thinking over platitudes about loving kids.',
  'Skilled Trades':
    'This is a skilled-trades or apprenticeship interview (electrician, plumber, HVAC, welding, machining, and the like). The role-specific question should center safety through a concrete situation — spotting a job-site hazard, following lockout/tagout, or being told to do something unsafe — and should include a pressure follow-up (the journeyman gets annoyed and says you are slowing the job; now what) that rewards holding the line respectfully over caving or being combative. The behavioral questions should probe reliability and life-logistics honestly (attendance, reliable transportation to early job sites and night classes, competing obligations), readiness for the classroom hours and basic math/aptitude, taking direction from a journeyman, and what concrete steps the candidate has already taken to prepare (info sessions, pre-apprenticeship, talking to members). Reward safety instinct, reliability, coachability, and genuine interest in the craft over slickness; keep it accessible for early-career candidates.',
  'Retail / Hospitality':
    'This is often an entry-level or first-ever interview for a customer-facing service role, so keep it warm and fair. The role-specific question should be a concrete service scenario — an upset customer, a service-recovery moment, a rush, or a cash-handling/honesty judgment call — rewarding genuine service orientation, reliability, composure under pressure, and a simple recovery instinct (listen, acknowledge, fix or escalate, follow up) over polish.',
  'Aviation / Pilot':
    'This is a professional pilot interview where safety culture is everything. The role-specific question should be a judgment/CRM scenario — a go/no-go or diversion decision, a disagreement with the captain or first officer, or a fatigue/fit-to-fly call — rewarding sound aeronautical decision-making, crew communication, and above all honesty about mistakes (own it, and what changed) over bravado or blame-shifting. Conceptual systems, weather, and regulation questions are fair; a type-rating exam is not.',
  'Social Work / Counseling':
    'This covers social work and counseling (clinical roles and graduate admissions alike). The role-specific question should be a concrete ethics-or-crisis scenario — a client in crisis, a confidentiality limit or mandated-reporting situation, or a boundary/dual-relationship dilemma — rewarding empathy held together with professional boundaries, a safety-first structured response (ensure safety, assess, follow the ethical code, involve a supervisor, document), and genuine self-awareness about burnout and bias over a vague "I want to help people".',
  'Academia / Faculty':
    'This is an academic faculty or postdoc job interview, not graduate admissions. The role-specific question should probe research vision and independence, teaching approach, and fit — how the candidate would summarize their research to a mixed audience, their future research and funding direction beyond their advisor’s work, or how they would teach a core course — rewarding a clear, independent research trajectory and the ability to communicate work to non-specialists over jargon.',
  'Pre-Med / Health Professional School':
    'This is a school admissions interview, not a job interview — the candidate is applying to this school for this program (MD, DO, PA, dental, nursing, etc.). Ground every question in what real medical/health-professional school interviews actually test: motivation for medicine grounded in a specific lived experience (never a platitude), sound judgment in an ethical or high-pressure scenario, teamwork and empathy in a clinical or caregiving context, and resilience after a genuine setback. The role-specific question should be a "why this school and program" fit question or a light situational-judgment scenario (a disagreement with a colleague, a difficult patient-communication moment) — never a clinical knowledge quiz. Avoid vague prompts like "why do you want to help people"; push for a specific, examined moment.',
  'Pre-Law / Law School':
    'This is a school admissions interview, not a job interview — the candidate is applying to this school for this program (JD, LLM, etc.). Ground every question in what real law school interviews actually test: STAR-structured behavioral questions about disagreement, engaging with an opposing viewpoint, leadership under pressure, and adapting to a significant unexpected change. The role-specific question should be a genuine "why law, why this school" question tied to something specific about the school (a clinic, a faculty member, a program strength) or a short current-events/legal-reasoning prompt asking the candidate to reason through both sides of an issue. Avoid generic "why do you want to be a lawyer" prompts — push for specificity.',
  'Graduate School (General)':
    'This is a school admissions interview, not a job interview — the candidate is applying to this school for this graduate program. Ground questions in academic and research motivation, a deep and specific dive on the candidate’s own project or area of study (with at least one probing follow-up — why that method, what is the weakness in the result, how would you extend it), handling an academic or research setback, and collaboration within an academic or lab setting. For research programs such as a PhD, the role-specific question should require the candidate to name two or three specific faculty or groups and justify the fit against their recent work, and should probe a concrete future research direction the candidate would pursue if admitted — not just a generic "why this program."',
  'Pharmacy / Dental / Vet / PT School':
    'This is a health-professional-school admissions interview for pharmacy, dental, veterinary, physical therapy, or optometry — not a job interview, and separate from medical or nursing school (use the Pre-Med vertical for those). Ground questions in what these interviews actually test: a specific, examined motivation for this exact profession (never a platitude about helping people or animals), a field-appropriate ethics or judgment scenario (a patient or pet owner who cannot afford care, a suspected colleague error, a scope-of-practice limit), empathy and communication in a clinical or caregiving context, and resilience after a real setback. The role-specific question should be a "why this profession and why this school" fit question or a light situational-judgment scenario — never a clinical-knowledge quiz.',
}

// Style anchors for the new fixed arc (2026 overhaul) — applied to every
// standard (non-override) vertical. Not injected for Coffee Chat / Startup,
// which have their own bespoke, non-STAR arcs below.
const BEHAVIORAL_STYLE_TARGET = `Model every behavioral question (Q4 and Q5) on the length and openness of these expert-approved examples — one to two sentences, no multi-clause scaffolding, no "walk me through X, then Y, and also quantify Z":
- "Tell me about a time you had to analyze a problem with incomplete information and still make a recommendation or decision."
- "Describe a time when someone on your team had a fundamentally different perspective than you did. How did you handle it?"
- "Tell me about a time something you worked hard on didn't have the impact you expected."
- "Tell me about a time you took initiative to solve a problem that no one asked you to solve."
At entry level, real interviewers screen for intangibles — self-starter instinct, coachability, admitting a mistake without arrogance, genuine motivation — not process knowledge or case mechanics. Ground Q4 and Q5 in those intangibles using the vertical guidance below, and keep them short and open — never hand the candidate the structure of the answer.`

const CURVEBALL_STYLE_TARGET = `Model the curveball (Q6) on this expert-approved example — a short, scenario-based prompt that tests resourcefulness and judgment, never a trick or a "gotcha":
"Imagine it's your first week and you've been staffed on a project in an industry you know almost nothing about. In five days you'll join your first working session with the client's VP of Operations. Walk me through how you'd prepare so you can contribute meaningfully — what would you focus on learning, where would you look, who would you seek out, and what would you decide isn't worth your time?"
Keep it concrete and specific to the vertical below, not generic.`

const ROLE_BOUNDARY_CALIBRATION = `Never ask an entry-level candidate to describe independently managing a situation above their actual role or authority (for example, an intern resolving an employee-relations matter entirely alone, or a first-year analyst unilaterally overriding a client decision). Frame these situations around judgment, prioritization, and knowing when and who to escalate to — "what would you do and who would you loop in" — never "how did you handle this entirely by yourself."`

export async function POST(req: NextRequest) {
  try {
    const {
      company,
      role,
      resumeText,
      linkedinUrl,
      sessionId,
      interviewType = 'General',
      difficulty = 'Medium',
    } = await req.json()

    if (!company || !role || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const level: Difficulty = (DIFFICULTY_OPTIONS as readonly string[]).includes(difficulty)
      ? difficulty
      : 'Medium'
    const isSchoolVertical = SCHOOL_VERTICALS.has(interviewType)

    // Create the Supabase client at request time (never at module/build time).
    // Use the cookie-aware SSR client so a signed-in user's session is present:
    // that lets us stamp the session with their user_id (RLS requires the insert
    // to run under their auth, i.e. auth.uid() = user_id). Guests have no cookie,
    // so this behaves like the anon client — user_id stays null, exactly as before.
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    const guidance = verticalGuidance[interviewType] ?? verticalGuidance['General']

    // Firm-specific interview-style note, only when the company is a known firm.
    const calibration = matchCompanyCalibration(company)

    const difficultyGuidance: Record<Difficulty, string> = {
      Easy:
        'Calibrate to Easy: keep questions foundational and accessible. Assume the candidate may be early-career, a student, or new to this field — coursework, internships, part-time jobs, and class projects are all fair source material, not just full-time professional experience. Keep the curveball light and low-pressure.',
      Medium:
        'Calibrate to Medium: assume the candidate has some relevant experience (internship-level to a few years) and calibrate accordingly.',
      Hard:
        'Calibrate to Hard: assume the candidate is targeting a competitive, senior-track opportunity. Behavioral questions should expect fully realized answers with real stakes, not a surface-level anecdote. The curveball can be more abstract or higher-pressure, while staying fair and never a "gotcha."',
    }

    // Fixed 6-question arc (2026 overhaul) — see the header comment above
    // verticalGuidance for the rationale. Types stay within
    // behavioral | role-specific | curveball, matching the Supabase
    // question_type check constraint, so no schema change is needed.
    const FIXED_ARC_ORDER = [
      '1. The universal opener — "Tell me about yourself."',
      '2. Motivation — why this candidate wants to work here (see instructions above)',
      '3. Self-knowledge — what this candidate actually wants to do (see instructions above)',
      '4. Short behavioral question targeting an intangible (e.g. initiative, ownership) — vertical-specific, not generic',
      '5. Short behavioral question targeting a different intangible (e.g. handling being wrong, taking feedback) — vertical-specific, not generic',
      '6. Curveball — short, scenario-based (see instructions above)',
    ]
    const FIXED_ARC_TYPES = ['behavioral', 'role-specific', 'role-specific', 'behavioral', 'behavioral', 'curveball']

    // Some verticals need a non-standard question arc that the fixed STAR-style
    // arc above actively fights (a networking coffee chat, a rapid founder
    // pitch). Override the order outright so the generated set matches the
    // vertical instead of being forced into a standard interview. Types stay
    // within behavioral | role-specific | curveball so the question_type
    // schema is unaffected — only the question wording changes.
    const arcOverrides: Record<string, string[]> = {
      'Coffee Chat': [
        '1. A warm opener about their career journey or how they got into this field',
        '2. A question asking what advice they would give someone starting out',
        '3. A question about a current trend or change in their industry',
        '4. A question about what their day-to-day work actually looks like',
        '5. A thoughtful question about a specific choice or turning point in their path',
        '6. A memorable, genuine question that shows real curiosity — never a gotcha',
      ],
      'Startup / Founder / VC': [
        '1. What are you building, and who is it for? Keep it concrete.',
        '2. How do you know they actually want it — what real evidence of demand do you have (users, revenue, growth, or specific customer conversations)?',
        '3. Why you and your team specifically, for this problem?',
        '4. What have you learned recently that changed your plan?',
        '5. Founder-market fit, your single biggest real risk, or your unit economics — with real numbers, not pitch-mode hand-waving',
        '6. A real founder curveball (for example: a well-funded incumbent ships your exact feature next week — what do you do in the next thirty days?)',
      ],
    }
    const arcOverride = arcOverrides[interviewType]
    const orderInstructions = (arcOverride ?? FIXED_ARC_ORDER).join('\n')
    // Override arcs reuse the same 4-behavioral + role-specific + curveball
    // type pattern so stored question_type values stay valid.
    const ARC_OVERRIDE_TYPES = ['behavioral', 'behavioral', 'behavioral', 'behavioral', 'role-specific', 'curveball']
    const expectedTypes = arcOverride ? ARC_OVERRIDE_TYPES : FIXED_ARC_TYPES

    const antiRepeatInstruction = 'Every question in this set — especially the behavioral ones — must probe a genuinely distinct situation, skill, or competency. Never generate two questions a candidate could answer with the same story. If following the guidance above would naturally produce overlapping angles, adjust the specific wording so each question targets a different moment, skill, or trade-off.'

    // Calibrate difficulty/scope to the seniority implied by the role, so an
    // intern and a senior hire in the same field get genuinely different questions.
    const seniorityInstruction = `Calibrate the depth, stakes, and scope of every question to the seniority implied by the role — "${role}"${resumeText ? ' and the resume below' : ''}. An intern, a new grad, and a more senior hire should not receive the same questions. For entry-level, student, first-job, or new-grad candidates, let the behavioral questions draw on coursework, internships, part-time jobs, volunteering, sports, or school, not just full-time work.`

    // Opener (Q1), motivation (Q2), and self-knowledge (Q3) instructions —
    // only used for the standard fixed arc (Coffee Chat / Startup have their
    // own opening questions built into arcOverrides above).
    const openerMotivationSelfKnowledge = isSchoolVertical
      ? `Question 1 is always the universal opener "Tell me about yourself." — write it exactly as that string, with no changes.
Question 2 is a short motivation question — a natural variant of "Why do you want to attend ${company} for the ${role} program?" — never settle for a generic or one-word-equivalent answer; the question itself should invite a specific, examined reason tied to this school.
Question 3 is a short self-knowledge question — a natural variant of "What do you want to do?", surfacing what actually draws this candidate to this field of study or path — brief, one sentence, open-ended.`
      : `Question 1 is always the universal opener "Tell me about yourself." — write it exactly as that string, with no changes.
Question 2 is a short motivation question — a natural variant of "Why do you want to work at ${company}?" — never settle for a generic or one-word-equivalent answer; the question itself should invite a specific, examined reason.
Question 3 is a short self-knowledge question — a natural variant of "What do you want to do?", surfacing what actually draws this candidate to this kind of work — brief, one sentence, open-ended.`

    // A shared realism floor that applies on top of the vertical guidance, to keep
    // questions accurate to a real interview rather than generic or trivia-like.
    const qualityBar = arcOverride && interviewType === 'Coffee Chat'
      ? `Quality bar: keep every question warm, open-ended, and genuinely conversational — the tone of a friendly chat over coffee. Do not ask interview-style, evaluative, or metrics-driven questions, do not demand a "why this company" justification, and never a gotcha.`
      : `Quality bar for every question: it must be realistic for an actual interview for this role at this company and level — the kind a real interviewer would actually ask. Every question must be answerable from the candidate’s own experience or live reasoning, never requiring insider information they could not have. Any "why this ${isSchoolVertical ? 'school or program' : 'company or role'}" question must demand a specific, examined reason and not settle for generic praise. Keep the curveball relevant to the field and fair — memorable, never a gotcha.`

    // Specialize to the actual industry/company, not just the broad vertical —
    // and keep Q4-Q5 recognizably about this field's actual work, not generic
    // with the field name swapped in.
    const specializationInstruction = `Specialize every question to the actual industry and business model implied by the company "${company}" and the role "${role}", not just the broad vertical. The motivation question (Q2) must reference something specific and real about ${company}, not generic praise. The two short behavioral questions (Q4-Q5) must be recognizably about the actual day-to-day work of this vertical and this specific role — generic behavioral questions "could apply to almost any function," so ground each in a real situation type from this field (see the vertical guidance below), never a generic prompt with the company or field name swapped in. Many verticals bundle several distinct sub-roles; identify the specific one the role "${role}" belongs to and calibrate accordingly — for example recruiting versus employee-relations for HR, or insurer-actuarial versus quant-trading for actuarial — rather than the vertical's default sub-type. If the role or the resume implies specialized expertise — a region, a language, a technical domain, or a distinctive academic background — let it inform the questions so they reward what makes this candidate distinctively qualified.`

    const framingIntro = interviewType === 'Coffee Chat'
      ? `You are helping someone prepare for an informal networking coffee chat with a professional at ${company} (their role: ${role}). This is a friendly, two-way conversation, NOT a job interview and NOT a candidate being evaluated. Write warm, genuine, open-ended conversation questions that build rapport and show curiosity — never interview-style, evaluative, or "gotcha" questions.`
      : isSchoolVertical
      ? `You are a warm, encouraging admissions interview coach preparing practice questions for a candidate applying to ${company} for their ${role} program. Your goal is to help this person grow and show their best self, so write questions that are appropriately challenging but always fair — open-ended prompts that give the candidate room to shine, never "gotcha" questions designed to trip them up. Even the curveball should feel like a thoughtful, energizing question, not an ambush.`
      : `You are a warm, encouraging interview coach preparing practice questions for a candidate applying to ${company} for the role of ${role}. Your goal is to help this person grow and show their best self, so write questions that are appropriately challenging but always fair — open-ended prompts that give the candidate room to shine, never "gotcha" questions designed to trip them up. Even the curveball should feel like a thoughtful, energizing question, not an ambush.`

    const prompt = `${framingIntro}

Interview vertical: ${interviewType}
Vertical guidance: ${guidance}
${calibration ? `\nKnown interview style at ${company} (use this to make the questions realistic for how this specific firm actually interviews, without naming the firm in the question text): ${calibration}\n` : ''}
${difficultyGuidance[level]}

${antiRepeatInstruction}

${seniorityInstruction}

${arcOverride ? '' : `${openerMotivationSelfKnowledge}\n\n${BEHAVIORAL_STYLE_TARGET}\n\n${CURVEBALL_STYLE_TARGET}\n\n${ROLE_BOUNDARY_CALIBRATION}\n\n`}${qualityBar}

${specializationInstruction}

${resumeText ? `Here is the candidate’s resume — ground at least one of the six questions in a specific, concrete detail from it (a named project, a listed skill or tool, a past role, or a visible gap), referencing the detail so the question feels written for this person while staying fair and answerable:\n${resumeText}\n` : ''}
${linkedinUrl ? `Candidate's LinkedIn: ${linkedinUrl}\n` : ''}

Generate exactly 6 interview questions tailored to the ${interviewType} vertical in the following order:
${orderInstructions}

Return ONLY a valid JSON array with no extra text, in this exact format:
[
${expectedTypes.map((t) => `  {"type": "${t}", "question": "..."}`).join(',\n')}
]`

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude')
    }

    let questions: Array<{ type: string; question: string }>
    try {
      const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found')
      questions = JSON.parse(jsonMatch[0])
    } catch {
      throw new Error('Failed to parse questions from Claude response')
    }

    if (!Array.isArray(questions) || questions.length !== 6) {
      throw new Error('Invalid question format returned')
    }

    // Quality gate: a fast second pass that catches questions which are
    // duplicative, off-level, or unanswerable/trivia and rewrites only those,
    // preserving each question's type and position. Best-effort — any failure
    // (parse, timeout, shape mismatch) falls back to the original generated set.
    try {
      const critiquePrompt = `You are a strict interview-question editor. Below are 6 practice interview questions generated for a candidate applying to ${company} for ${isSchoolVertical ? `the ${role} program` : `the role of ${role}`} (vertical: ${interviewType}, difficulty: ${level}).

Review each question against three tests:
1. Distinct — no two questions can be answered with the same story or example.
2. Level-appropriate — calibrated to the seniority implied by "${role}", neither too basic nor too advanced.
3. Short and open — one to two sentences, no multi-clause scaffolding that hands the candidate the structure of the answer, and realistic and answerable — the kind of question a real interviewer would ask, never a trivia/definition question or one requiring insider information.

Keep every question that passes all three tests exactly as written. Rewrite only the ones that fail, keeping the same "type" value and the same position in the list. Return ONLY a valid JSON array of exactly 6 objects, in the original order and with the original "type" values:
${JSON.stringify(questions)}`

      const critique = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1536,
        messages: [{ role: 'user', content: critiquePrompt }],
      })
      const critiqueBlock = critique.content.find((b) => b.type === 'text')
      if (critiqueBlock && critiqueBlock.type === 'text') {
        const match = critiqueBlock.text.match(/\[[\s\S]*\]/)
        if (match) {
          const revised = JSON.parse(match[0]) as Array<{ type: string; question: string }>
          const validTypes = new Set(['behavioral', 'role-specific', 'curveball'])
          const isClean =
            Array.isArray(revised) &&
            revised.length === 6 &&
            revised.every(
              (q, i) =>
                q &&
                typeof q.question === 'string' &&
                q.question.trim().length > 0 &&
                q.type === questions[i].type &&
                validTypes.has(q.type)
            )
          if (isClean) questions = revised
        }
      }
    } catch {
      // Keep the original questions on any gate failure — never block generation.
    }

    // Deterministic override for the universal opener — guarantees Q1 is
    // always exactly "Tell me about yourself." on the standard arc, rather
    // than trusting prompt-following (which can drift or get paraphrased by
    // the quality gate above). Coffee Chat / Startup keep their own openers.
    if (!arcOverride && questions[0]) {
      questions[0] = { type: 'behavioral', question: 'Tell me about yourself.' }
    }

    // Store session in Supabase. Stamp user_id for signed-in users; guests
    // stay null (unchanged behavior). Derived server-side from the verified
    // session — never trusted from the client.
    const { error: sessionError } = await supabase.from('sessions').insert({
      id: sessionId,
      company,
      role,
      linkedin_url: linkedinUrl || null,
      user_id: user?.id ?? null,
    })

    if (sessionError) throw new Error(`Supabase session error: ${sessionError.message}`)

    // Store questions
    const questionRows = questions.map((q, i) => ({
      session_id: sessionId,
      question_text: q.question,
      question_type: q.type as 'behavioral' | 'role-specific' | 'curveball',
      order_index: i,
    }))

    const { error: questionsError } = await supabase.from('questions').insert(questionRows)
    if (questionsError) throw new Error(`Supabase questions error: ${questionsError.message}`)

    return NextResponse.json({ success: true, sessionId })
  } catch (err: any) {
    console.error('Generate questions error:', err)
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
