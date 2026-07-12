import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabaseServerClient'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Two model calls now run per request (generate + quality-gate), so give the
// function headroom beyond the platform default to avoid edge-case timeouts.
export const maxDuration = 60

// Verticals that are school admissions interviews, not job interviews.
// "company" is read as the target school; "role" is read as the program/degree.
const SCHOOL_VERTICALS = new Set([
  'Pre-Med / Health Professional School',
  'Pre-Law / Law School',
  'Graduate School (General)',
  'Business School / MBA',
  'Pharmacy / Dental / Vet / PT School',
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

const QUESTION_FOCUS_OPTIONS = ['Balanced', 'Behavioral-Heavy', 'Technical-Heavy'] as const
type QuestionFocus = (typeof QUESTION_FOCUS_OPTIONS)[number]

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'] as const
type Difficulty = (typeof DIFFICULTY_OPTIONS)[number]

export async function POST(req: NextRequest) {
  try {
    const {
      company,
      role,
      resumeText,
      linkedinUrl,
      sessionId,
      interviewType = 'General',
      questionFocus = 'Balanced',
      difficulty = 'Medium',
    } = await req.json()

    if (!company || !role || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const focus: QuestionFocus = (QUESTION_FOCUS_OPTIONS as readonly string[]).includes(questionFocus)
      ? questionFocus
      : 'Balanced'
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

    const verticalGuidance: Record<string, string> = {
      'Finance':
        'Finance spans distinct sub-fields — corporate finance/FP&A, buy-side investing, and markets — so calibrate to the stated role rather than treating it as one thing. The role-specific question should force a defensible point of view, not a definition: how a change in a key assumption flows through a model and why, how to think about a company’s capital structure, or a short "walk me through an investment or a stock you would pitch, and the two or three reasons the market is mispricing it" prompt. Push for real numbers and a clear recommendation with a stated risk, and reward quantitative judgment under ambiguity over recited valuation vocabulary. (Investment Banking and Private Equity have their own verticals for deal and LBO technicals.)',
      'Investment Banking':
        'Focus on deal-process fluency, technical modeling (LBO mechanics, M&A accretion/dilution, DCF), pitch and client-facing experience, and composure under long-hours, high-pressure conditions. The role-specific question should test IB technical depth — e.g., walk through how a DCF is built, explain what drives accretion/dilution in a stock deal, or how leverage affects LBO returns.',
      'Private Equity':
        'Focus on deal sourcing and diligence instincts, investment thesis construction, portfolio company operating involvement, and returns math. The role-specific question should probe PE fundamentals — MOIC vs. IRR, key value-creation levers (multiple expansion, deleveraging, EBITDA growth), or a short case-style prompt to evaluate a hypothetical target.',
      'Consulting':
        'Include a case-style, structured problem-solving question that forces the candidate to build a framework live, not recite one — and make it multi-step within the single prompt: first ask them to structure the problem and state prioritized hypotheses, then reveal a specific data point and ask where they focus, then require one small quantitative calculation (a margin, break-even, or profit-impact estimate) so quant is never skipped. Vary the case type across sessions (profitability, market entry, market sizing, operations). At least one behavioral question should be pushed to experience-interview depth — quantified impact and the candidate’s specific individual role versus the team’s. Reward structured, hypothesis-driven thinking and clean math over a memorized framework.',
      'Tech':
        'Calibrate to the actual tech role — software engineering, data, product, or infrastructure — rather than "tech" in general. The role-specific question should be a concrete, level-appropriate problem the candidate reasons through out loud — a design or debugging scenario, a build-vs-buy or scaling trade-off, or a "how would you approach X" prompt — rewarding clarifying questions first, an explicit approach before the answer, and stated trade-offs and complexity over a memorized fact. Also probe cross-functional judgment: working with product and design, or handling a technical disagreement. Avoid a generic "tell me about a technology you like" prompt; for a pure coding or algorithms screen, push a layer deeper into the actual data-structure or system-design problem.',
      'Real Estate':
        'Focus on deal underwriting mechanics, cap rate and IRR intuition, market/submarket analysis, and asset management trade-offs. The role-specific question should test real estate finance fundamentals — e.g., how cap rate relates to price, what drives NOI, or how to evaluate a value-add opportunity.',
      'Marketing':
        'Marketing spans performance/growth, brand, and partnership/sponsorship models — first infer which one actually dominates for this specific role and company. For growth/performance roles, focus on channel-prioritization trade-offs under a budget constraint, first-party data in a cookieless environment, and reallocating spend away from an underperforming channel, pushing for real metrics (CAC, conversion rate, ROAS). For sports, entertainment, and sponsorship-driven organizations, prioritize instead sponsorship and partnership activation and renewal, sponsorship ROI (impression value, brand lift, activation reach, renewal rate), ticketing/attendance and yield, and fan and community engagement — and use those metrics, not CAC/ROAS. The role-specific question should be a live diagnostic or trade-off in the model that actually drives revenue for this role and company, and should demand real numbers rather than described intuition.',
      'Sales':
        'This role expects a real scenario, not a definition. Ground the role-specific question in one specific buyer persona and one specific objection from real deal patterns — a price pushback mid-negotiation, a stalled deal where the champion has gone quiet, a competitor lock-in on renewal, or a prospect demanding pricing before discovery — and ask the candidate to write out exactly what they would say and why, using a real qualification framework (BANT, MEDDIC, or SPICED); frame it as rehearsal for a live role-play so they practice saying it out loud. Force hard numbers in the behavioral questions: quota and attainment, average deal size, sales-cycle length, win rate, and how much pipeline they self-source versus receive. Probe a lost deal (what they would change with hindsight). Reward specifics and real language over a generic "I would build rapport."',
      'Healthcare':
        'Calibrate to the stated healthcare role — clinical, administrative, or health-tech — rather than "healthcare" in general. The role-specific question should be a concrete scenario that surfaces judgment and a patient-safety-first instinct: prioritizing among competing demands, responding to a deteriorating situation or an error, or safely raising a concern up the chain — rewarding a structured approach and honest escalation over "I care about patients." For clinical roles, reward structured handoff communication (for example, SBAR) and interdisciplinary teamwork; for administrative or health-tech roles, ground it in the operational or compliance reality of the job. Avoid a generic "why healthcare" prompt.',
      'Accounting':
        'Focus on technical accuracy under GAAP/IFRS, process and controls thinking, and how the candidate handles a discrepancy or deadline pressure. The role-specific question should involve a concrete accounting scenario — a reconciliation issue, a revenue recognition judgment call, or how to handle a client disagreement over treatment.',
      'Audit':
        'Focus on professional skepticism, risk assessment, materiality judgment, and navigating disagreements with a client. The role-specific question should present a concrete audit scenario — identifying a control weakness, evaluating a management estimate, or deciding whether an issue rises to material — rather than asking generically about "attention to detail."',
      'Operations':
        'Focus on structured root-cause thinking under real constraints and cross-functional coordination. The role-specific question should present a concrete operational breakdown — a supply-chain delay, a workflow bottleneck, a capacity constraint, or a quality/defect spike — and ask the candidate to diagnose and prioritize a fix: define the metric that moved, map the process, isolate where it breaks, quantify the impact, fix the root cause rather than the symptom, and sustain it. Reward real numbers and a recognizable improvement instinct (Lean and the eight wastes, 5 Whys, DMAIC) over a generic "I would talk to the team," and probe a trade-off where speed, cost, and quality conflict.',
      'Human Resources':
        'Ground the role-specific question in a concrete employee relations scenario requiring real judgment — not "how do you handle conflict" in the abstract, but a specific situation (two employees in an ongoing dispute, a manager avoiding a hard performance conversation, an unpopular new policy rollout) where the candidate must show a structured process: separate conversations first, documentation, a follow-up check-in, and a clear line between coaching, a formal performance path, and escalation to legal or leadership when the facts warrant it. Push for how they would handle competing priorities (a compliance deadline versus an urgent employee relations issue) and how they navigate confidentiality.',
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
      'Product Management':
        'Focus on product sense, structured prioritization, and metrics judgment. The role-specific question should be a product-design, estimation, or metrics/prioritization prompt (e.g. "improve product X for user Y", "how would you measure the success of feature Z", or "which of these two features would you build first") that forces the candidate to clarify the user and the goal first, structure trade-offs, and define a success metric — never a throwaway "what is your favorite product".',
      'Data / Analytics':
        'Focus on hypothesis-driven analytical reasoning and clear communication of ambiguity. The role-specific question should be a concrete analytics scenario or a conceptual SQL/statistics question — e.g. "how would you investigate a 15% drop in a key metric", "when would you trust or distrust an A/B test result", or how to turn a vague business question into an analysis — rewarding structured reasoning and explicit assumptions over recall of formulas.',
      'Design (UX / Product)':
        'This role centers on the candidate’s reasoning, not pixels. The role-specific question should be a design-challenge or critique prompt (e.g. "design a scheduling app for busy parents", or "critique the onboarding of a product you use") that pushes the candidate to clarify the user and constraints, walk through their process and key trade-offs, and justify decisions with real user needs — never a question that rewards visual polish over thinking.',
      'Cybersecurity':
        'Focus on a systematic security mindset over trivia. The role-specific question should be a concrete scenario — how the candidate would secure a given system, walk through responding to a suspected breach, or threat-model a new feature — grounded in real fundamentals (least privilege, the CIA triad, common OWASP-style vulnerabilities) and a clear detect → triage → contain → remediate → prevent instinct, not memorized definitions.',
      'Project / Program Management':
        'This is delivery/execution management, not product management. The role-specific question should be a concrete delivery scenario — a slipping timeline, scope creep mid-project, a conflict between engineering and the business, or a stalled cross-functional initiative — that forces the candidate to show structured planning, risk management, and influence without authority, referencing real methods (Agile/Scrum ceremonies, RACI, a risk register) rather than a generic "I keep everyone aligned".',
      'Customer Success':
        'Focus on empathy under pressure balanced with commercial awareness. The role-specific question should be a real customer scenario — an at-risk account about to churn, an escalation, a renewal or upsell conversation, or delivering bad news like a delayed feature — asking the candidate to write out exactly how they would handle it (acknowledge, diagnose, own the path forward, set expectations, follow through) and to reference retention/expansion metrics (churn, NRR, CSAT), not just "I would make the customer happy".',
      'Media / Journalism / PR':
        'Focus on news/message judgment, writing clarity, and composure under deadline. The role-specific question should be grounded in a concrete scenario — pitch a story and defend why it is newsworthy, handle a correction or a sourcing-ethics dilemma, or manage a reputational crisis (get the facts, identify stakeholders, craft a clear honest message, choose the channel) — rewarding sharp editorial judgment and ethics over buzzwords.',
      'Law / Legal':
        'This is a legal-employment interview (law firm, in-house, clerkship, or a 1L/2L summer-associate OCI), not law-school admissions. The role-specific question should probe legal judgment and professional responsibility through a concrete situation — an ambiguous client problem with incomplete facts, or a genuine ethics/confidentiality dilemma (a client confidence, a conflict of interest, discovering an error in already-filed work, or a peer cutting corners) — and it should be paired with a specific, non-generic "why this firm and practice area" that demands real differentiation from other firms rather than being an afterthought. For students and early-career candidates, explicitly allow examples from law school, a journal, a clinic, undergrad, or prior work, not just legal jobs. Reward structured reasoning and professional judgment; do not quiz black-letter law.',
      'Nursing':
        'This is a clinical-nursing job interview. The role-specific question should be a patient-care scenario testing clinical judgment and safety — prioritizing among several patients (most-unstable-first / ABCs), responding to a deteriorating patient, handling a medication error, or safely escalating a disagreement over an unsafe order — and it should push beyond triage to the actual safety actions: how the candidate would delegate to a tech or charge nurse rather than doing everything alone, and exactly what they would say when they escalate, structured as SBAR (Situation, Background, Assessment, Recommendation). At least one behavioral question should probe honest self-awareness of a current weakness or worry as a new nurse. Reward a patient-safety-first instinct and clear chain-of-command escalation over a generic "I am compassionate."',
      'Teaching / Education':
        'This is a K-12 teaching interview. The role-specific question should be a concrete classroom scenario — a disruptive student, differentiating a lesson for varied levels, a difficult parent conversation, or how the candidate would structure a specific lesson (objective, hook, guided and independent practice, a check for understanding) — rewarding concrete, student-centered moves and assessment/data thinking over platitudes about loving kids.',
      'Startup / Founder / VC':
        'These are rapid, two-way evaluative conversations (a YC-style interview is roughly ten minutes of fast, specific back-and-forth), not a behavioral STAR interview — so do NOT use the standard behavioral arc here. Replace the four behavioral questions with fast, concrete, startup-specific questions: what are you building and who is it for; how do you know they actually want it (real evidence of demand, with numbers — users, revenue, growth, or specific customer conversations); why you and your team specifically; and what you have learned recently that changed your plan. Each should be answerable in a sentence or two with real specifics, rewarding concrete numbers and honesty over pitch-mode hand-waving. The role-specific question should probe founder-market fit, the single biggest real risk, or unit economics and equity/commitment precision. The curveball should be a real founder scenario (for example, a well-funded incumbent ships your exact feature next week — what do you do in the next thirty days). Expect the candidate to ask sharp questions back.',
      'Skilled Trades':
        'This is a skilled-trades or apprenticeship interview (electrician, plumber, HVAC, welding, machining, and the like). The role-specific question should center safety through a concrete situation — spotting a job-site hazard, following lockout/tagout, or being told to do something unsafe — and should include a pressure follow-up (the journeyman gets annoyed and says you are slowing the job; now what) that rewards holding the line respectfully over caving or being combative. The behavioral questions should probe reliability and life-logistics honestly (attendance, reliable transportation to early job sites and night classes, competing obligations), readiness for the classroom hours and basic math/aptitude, taking direction from a journeyman, and what concrete steps the candidate has already taken to prepare (info sessions, pre-apprenticeship, talking to members). Reward safety instinct, reliability, coachability, and genuine interest in the craft over slickness; keep it accessible for early-career candidates.',
      'Retail / Hospitality':
        'This is often an entry-level or first-ever interview for a customer-facing service role, so keep it warm and fair. The role-specific question should be a concrete service scenario — an upset customer, a service-recovery moment, a rush, or a cash-handling/honesty judgment call — rewarding genuine service orientation, reliability, composure under pressure, and a simple recovery instinct (listen, acknowledge, fix or escalate, follow up) over polish.',
      'Aviation / Pilot':
        'This is a professional pilot interview where safety culture is everything. The role-specific question should be a judgment/CRM scenario — a go/no-go or diversion decision, a disagreement with the captain or first officer, or a fatigue/fit-to-fly call — rewarding sound aeronautical decision-making, crew communication, and above all honesty about mistakes (own it, and what changed) over bravado or blame-shifting. Conceptual systems, weather, and regulation questions are fair; a type-rating exam is not.',
      'Actuarial / Quant':
        'This covers actuarial and quantitative-finance roles. The role-specific question should be a probability/expected-value brainteaser, a Fermi estimation, or a market-making-style puzzle the candidate must reason through out loud — stating assumptions, working step by step, sanity-checking, and committing to a number — rewarding structured quantitative reasoning and composure under a hard problem over merely landing the right answer. For actuarial candidates, exam progress (SOA/CAS) is fair to probe.',
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
      'Business School / MBA':
        'This is an MBA admissions interview, not a job interview — the candidate is applying to this business school for their MBA. Ground questions in leadership and impact stories (STAR-structured, with the candidate’s individual contribution clearly distinguishable from the team’s), a specific and credible post-MBA goal with a real why-now, and genuine fit with this school. The role-specific question should be a "why an MBA, why this school, why now" fit question tied to something specific (a program, club, professor, or value), or a leadership/teamwork scenario — never a generic "why do you want an MBA". Push for a specific, examined reason.',
      'Pharmacy / Dental / Vet / PT School':
        'This is a health-professional-school admissions interview for pharmacy, dental, veterinary, physical therapy, or optometry — not a job interview, and separate from medical or nursing school (use the Pre-Med vertical for those). Ground questions in what these interviews actually test: a specific, examined motivation for this exact profession (never a platitude about helping people or animals), a field-appropriate ethics or judgment scenario (a patient or pet owner who cannot afford care, a suspected colleague error, a scope-of-practice limit), empathy and communication in a clinical or caregiving context, and resilience after a real setback. The role-specific question should be a "why this profession and why this school" fit question or a light situational-judgment scenario — never a clinical-knowledge quiz.',
      'Coffee Chat':
        'This is an informal networking conversation, not a formal interview. Replace the behavioral questions with 4 natural conversation-starter questions (career journey, advice, industry trends, day-to-day experience). Replace the role-specific question with a thoughtful question about their path. The curveball should be a memorable, genuine question that shows curiosity. Keep all questions open-ended and conversational.',
      'General':
        'Use broadly applicable behavioral and situational questions suitable for any industry or role.',
    }

    const guidance = verticalGuidance[interviewType] ?? verticalGuidance['General']

    // Firm-specific interview-style note, only when the company is a known firm.
    const calibration = matchCompanyCalibration(company)

    // Controls how many of each question type appear, and in what order.
    // Every type must still be one of behavioral | role-specific | curveball —
    // these match the Supabase question_type check constraint, so no schema change is needed.
    const focusOrder: Record<QuestionFocus, string[]> = {
      Balanced: [
        '1. Behavioral question (STAR method expected)',
        '2. Behavioral question (teamwork/collaboration)',
        '3. Behavioral question (handling failure or conflict)',
        '4. Behavioral question (leadership or initiative)',
        '5. Role-specific question — follow the vertical guidance above',
        '6. Curveball / creative / unexpected question',
      ],
      'Behavioral-Heavy': [
        '1. Behavioral question (STAR method expected)',
        '2. Behavioral question (teamwork/collaboration)',
        '3. Behavioral question (handling failure or conflict)',
        '4. Behavioral question (leadership or initiative)',
        '5. Behavioral question (adaptability — handling ambiguity or a significant unexpected change)',
        '6. Curveball / creative / unexpected question',
      ],
      'Technical-Heavy': [
        '1. Behavioral question (STAR method expected) — keep exactly one grounding behavioral question',
        '2. Role-specific question — tests a foundational concept from the vertical guidance above',
        '3. Role-specific question — an applied scenario requiring judgment, not recall',
        '4. Role-specific question — a trade-off or "how would you decide between X and Y" question',
        '5. Role-specific question — the deepest/most advanced probe from the vertical guidance above',
        '6. Curveball / creative / unexpected question',
      ],
    }

    const focusTypeMap: Record<QuestionFocus, string[]> = {
      Balanced: ['behavioral', 'behavioral', 'behavioral', 'behavioral', 'role-specific', 'curveball'],
      'Behavioral-Heavy': ['behavioral', 'behavioral', 'behavioral', 'behavioral', 'behavioral', 'curveball'],
      'Technical-Heavy': ['behavioral', 'role-specific', 'role-specific', 'role-specific', 'role-specific', 'curveball'],
    }

    const difficultyGuidance: Record<Difficulty, string> = {
      Easy:
        'Calibrate to Easy: keep questions foundational and accessible. Assume the candidate may be early-career, a student, or new to this field — coursework, internships, part-time jobs, and class projects are all fair source material, not just full-time professional experience. Role-specific questions should test core concepts rather than advanced application. Keep the curveball light and low-pressure.',
      Medium:
        'Calibrate to Medium: assume the candidate has some relevant experience (internship-level to a few years) and calibrate accordingly. Role-specific questions should test applied understanding, not just definitions — the candidate should have to reason, not just recall.',
      Hard:
        'Calibrate to Hard: assume the candidate is targeting a competitive, senior-track opportunity. Role-specific questions should probe edge cases, require the candidate to quantify trade-offs, and go a layer deeper than a textbook answer — the kind of question that separates a good answer from a great one. Behavioral questions should expect fully realized STAR answers with real stakes, not a surface-level anecdote. The curveball can be more abstract or higher-pressure, while staying fair and never a "gotcha."',
    }

    // Some verticals need a non-standard question arc that the behavioral-heavy
    // default actively fights (a networking coffee chat, a rapid founder pitch).
    // Override the order outright so the generated set matches the vertical
    // instead of being forced into a STAR interview. Types stay within
    // behavioral | role-specific | curveball so the question_type schema is
    // unaffected — only the question wording changes.
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
    const orderInstructions = (arcOverride ?? focusOrder[focus]).join('\n')
    // Override arcs reuse the Balanced type pattern (4 + role-specific + curveball)
    // so stored question_type values stay valid.
    const expectedTypes = arcOverride ? focusTypeMap.Balanced : focusTypeMap[focus]

    const antiRepeatInstruction = 'Every question in this set — especially the behavioral ones — must probe a genuinely distinct situation, skill, or competency. Never generate two questions a candidate could answer with the same story (for example, do not ask both a general "walk me through your background" question and a separate "tell me about a relevant experience" question — these overlap). If following the guidance above would naturally produce overlapping angles, adjust the specific wording so each question targets a different moment, skill, or trade-off.'

    // Calibrate difficulty/scope to the seniority implied by the role, so an
    // intern and a senior hire in the same field get genuinely different questions.
    const seniorityInstruction = `Calibrate the depth, stakes, and scope of every question to the seniority implied by the role — "${role}"${resumeText ? ' and the resume below' : ''}. An intern, a new grad, an individual contributor, and a senior or leadership hire should not receive the same questions. If the role implies managing people or leading, include at least one question about leading, influencing, or making decisions for others. For entry-level, student, first-job, or new-grad candidates, keep the role-specific question foundational (not senior-judgment calls the candidate would not yet face) and let the behavioral questions draw on coursework, internships, part-time jobs, volunteering, sports, or school, not just full-time work.`

    // A shared realism floor that applies on top of the vertical guidance, to keep
    // questions accurate to a real interview rather than generic or trivia-like.
    const qualityBar = arcOverride && interviewType === 'Coffee Chat'
      ? `Quality bar: keep every question warm, open-ended, and genuinely conversational — the tone of a friendly chat over coffee. Do not ask interview-style, evaluative, or metrics-driven questions, do not demand a "why this company" justification, and never a gotcha.`
      : `Quality bar for every question: it must be realistic for an actual interview for this role at this company and level — the kind a real interviewer would actually ask. Do not ask textbook-definition or trivia questions; ask the candidate to reason, decide, or recount real experience rather than recite a definition. Every question must be answerable from the candidate’s own experience or live reasoning, never requiring insider information they could not have. Any "why this ${isSchoolVertical ? 'school or program' : 'company or role'}" question must demand a specific, examined reason and not settle for generic praise. Keep the curveball relevant to the field and fair — memorable, never a gotcha.`

    // Specialize to the actual industry/company, not just the broad vertical —
    // otherwise the vertical guidance imposes the wrong model (e.g. digital-
    // marketing metrics on a sports-marketing role at a pro team).
    const specializationInstruction = `Specialize the role-specific and curveball questions to the actual industry and business model implied by the company "${company}" and the role "${role}", not just the broad vertical. Identify the dominant real-world levers and metrics for this exact role at this organization and target the role-specific question there — if the vertical's default framing or metrics do not fit the industry (for example, digital-marketing metrics like CAC or ROAS for a sports, entertainment, or nonprofit marketing role), substitute the ones that industry actually uses. Any "why this ${isSchoolVertical ? 'school or program' : 'company or organization'}" angle must reflect something specific and real about ${company}. If the role or the resume implies specialized expertise — a region, a language, a technical domain, or a distinctive academic background — make at least one question require that specific expertise rather than a generic competency, so the questions reward what makes this candidate distinctively qualified rather than interviewing them as a generic hire. Many verticals bundle several distinct sub-roles; identify the specific one the role "${role}" belongs to and target the role-specific question at it — for example recruiting versus employee-relations for HR, a reporter versus PR for media, insurer-actuarial versus quant-trading for actuarial, or a customer-facing solutions/sales engineer versus pure coding for tech — rather than the vertical's default sub-type.`

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

${qualityBar}

${specializationInstruction}

${resumeText ? `Here is the candidate’s resume — ground at least two of the six questions in specific, concrete details from it (a named project, a listed skill or tool, a past role, or a visible gap), referencing the detail so the question feels written for this person while staying fair and answerable:\n${resumeText}\n` : ''}
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
3. Realistic and answerable — the kind of question a real interviewer would ask, answerable from the candidate's own experience or live reasoning, never a trivia/definition question or one that requires insider information.

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
