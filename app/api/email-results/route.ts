import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { to, firstName, company, role, result, fillerCount, blindSpot } = await req.json()

    if (!to || !company || !role || !result) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(to)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })

    const { overallScore, evaluations, biggestMistakes, improvements, exampleBetterAnswer } = result

    // Average dimension scores across all questions
    const count = evaluations.length || 1
    const avg = evaluations.reduce(
      (acc: any, ev: any) => ({
        clarity:    acc.clarity    + ev.scores.clarity    / count,
        confidence: acc.confidence + ev.scores.confidence / count,
        structure:  acc.structure  + ev.scores.structure  / count,
        relevance:  acc.relevance  + ev.scores.relevance  / count,
      }),
      { clarity: 0, confidence: 0, structure: 0, relevance: 0 }
    )

    const scoreColor = (s: number) => s >= 8 ? '#D9FF3F' : s >= 6 ? '#facc15' : '#f87171'
    const overallHex = scoreColor(overallScore)

    const starLabel = (r: string) =>
      r === 'present' ? '✓ Present' : r === 'weak' ? '~ Weak' : '✗ Missing'
    const starColor = (r: string) =>
      r === 'present' ? '#D9FF3F' : r === 'weak' ? '#facc15' : '#f87171'

    const dimRow = (label: string, val: number) => `
      <tr>
        <td style="padding:8px 0;color:#9ca3af;font-size:13px;">${label}</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:${scoreColor(val)};font-size:13px;">${val.toFixed(1)}/10</td>
      </tr>`

    const starRows = evaluations.map((ev: any, i: number) => {
      const s = ev.star
      return `
        <div style="margin-bottom:16px;">
          <p style="margin:0 0 6px;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Q${i + 1}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#d1d5db;line-height:1.5;">${ev.question}</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
            ${(['situation','task','action','result'] as const).map(c => `
              <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${starColor(s[c])}22;color:${starColor(s[c])};border:1px solid ${starColor(s[c])}44;">
                ${c[0].toUpperCase()} · ${starLabel(s[c])}
              </span>`).join('')}
            <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#FF5A1F22;color:#FF5A1F;border:1px solid #FF5A1F44;">
              STAR ${s.starScore}/4
            </span>
          </div>
          ${s.starCoaching ? `<p style="margin:0;font-size:12px;color:#f0b49a;line-height:1.5;padding:6px 10px;background:#FF5A1F0d;border-left:2px solid #FF5A1F;border-radius:0 4px 4px 0;">${s.starCoaching}</p>` : ''}
        </div>`
    }).join('')

    const FORM_URL = 'https://docs.google.com/forms/d/1aCvDzFyUWJx4-KkPzQ-FINWARaYjY6f276phmf4SxAU/viewform'
    const greeting = firstName ? `Hey ${firstName},` : 'Hey,'

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your Runback Results</title></head>
<body style="margin:0;padding:0;background:#0e0b08;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0e0b08;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#FF5A1F,#E64A12);border-radius:16px 16px 0 0;padding:32px 32px 28px;text-align:center;">
        <div style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;background:rgba(18,18,18,.22);border-radius:12px;margin-bottom:12px;">
          <span style="color:#fff;font-weight:800;font-size:18px;letter-spacing:-1px;">◀◀</span>
        </div>
        <h1 style="margin:0 0 4px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px;">Runback</h1>
        <p style="margin:0;color:rgba(255,255,255,.85);font-size:14px;">${company} · ${role}</p>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="background:#1a1712;padding:24px 32px 0;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <p style="margin:0;color:#F5F1E8;font-size:15px;line-height:1.6;">${greeting} here's the tape from your rep at ${company}. Study what worked, tighten what didn't, then run it back.</p>
      </td></tr>

      <!-- Overall score -->
      <tr><td style="background:#1a1712;padding:28px 32px;text-align:center;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <p style="margin:0 0 4px;color:#8a8275;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Overall Score</p>
        <p style="margin:0 0 8px;font-size:64px;font-weight:800;color:${overallHex};line-height:1;">${overallScore}</p>
        <p style="margin:0;color:#6b6355;font-size:16px;">/10</p>
      </td></tr>

      <!-- Score breakdown -->
      <tr><td style="background:#1a1712;padding:0 32px 24px;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <div style="background:#14110d;border:1px solid #2a251d;border-radius:12px;padding:16px 20px;">
          <p style="margin:0 0 4px;color:#8a8275;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Score Breakdown</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${dimRow('Clarity',    avg.clarity)}
            ${dimRow('Confidence', avg.confidence)}
            ${dimRow('Structure',  avg.structure)}
            ${dimRow('Relevance',  avg.relevance)}
            ${fillerCount > 0 ? `<tr><td style="padding:8px 0;color:#b8b0a2;font-size:13px;">Filler words</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#facc15;font-size:13px;">${fillerCount} detected</td></tr>` : '<tr><td style="padding:8px 0;color:#b8b0a2;font-size:13px;">Filler words</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#D9FF3F;font-size:13px;">None detected</td></tr>'}
          </table>
        </div>
      </td></tr>

      ${blindSpot?.name ? `
      <!-- Blind Spot -->
      <tr><td style="background:#1a1712;padding:0 32px 24px;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <div style="background:#1c0a0a;border:1px solid #7f1d1d55;border-radius:12px;padding:20px;">
          <p style="margin:0 0 4px;color:#ef4444;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Your Blind Spot</p>
          <p style="margin:0 0 6px;color:#fca5a5;font-size:15px;font-weight:700;">${blindSpot.name}</p>
          <p style="margin:0;color:#fca5a580;font-size:13px;line-height:1.6;">${blindSpot.description}</p>
        </div>
      </td></tr>` : ''}

      <!-- Feedback form CTA -->
      <tr><td style="background:#1a1712;padding:0 32px 24px;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <div style="background:linear-gradient(135deg,#2a1a12,#1f1510);border:1px solid #FF5A1F55;border-radius:12px;padding:24px;text-align:center;">
          <p style="margin:0 0 8px;color:#FF5A1F;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">Quick favour</p>
          <p style="margin:0 0 16px;color:#F5F1E8;font-size:16px;font-weight:700;">Take 60 seconds to tell us what you think</p>
          <p style="margin:0 0 20px;color:#b8b0a2;font-size:13px;line-height:1.5;">Your feedback directly shapes how we make Runback better. It takes under a minute.</p>
          <a href="${FORM_URL}" style="display:inline-block;background:#FF5A1F;color:#ffffff;font-weight:700;font-size:14px;padding:12px 32px;border-radius:10px;text-decoration:none;">Give Feedback →</a>
        </div>
      </td></tr>

      <!-- STAR analysis -->
      <tr><td style="background:#1a1712;padding:0 32px 24px;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <p style="margin:0 0 16px;color:#8a8275;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;">STAR Analysis</p>
        ${starRows}
      </td></tr>

      <!-- Biggest mistakes -->
      <tr><td style="background:#1a1712;padding:0 32px 24px;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <div style="background:#1c0a0a;border:1px solid #3b1515;border-radius:12px;padding:20px;">
          <p style="margin:0 0 14px;color:#fca5a5;font-size:13px;font-weight:600;">3 Biggest Mistakes</p>
          ${biggestMistakes.map((m: string, i: number) => `
            <div style="display:flex;gap:10px;margin-bottom:${i < 2 ? '10px' : '0'};">
              <span style="color:#ef4444;font-weight:700;font-size:13px;min-width:16px;">${i + 1}.</span>
              <p style="margin:0;color:#fca5a5;font-size:13px;line-height:1.5;">${m}</p>
            </div>`).join('')}
        </div>
      </td></tr>

      <!-- Improvements -->
      <tr><td style="background:#1a1712;padding:0 32px 24px;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <div style="background:#071a0e;border:1px solid #14532d40;border-radius:12px;padding:20px;">
          <p style="margin:0 0 14px;color:#86efac;font-size:13px;font-weight:600;">3 Key Improvements</p>
          ${improvements.map((tip: string, i: number) => `
            <div style="display:flex;gap:10px;margin-bottom:${i < 2 ? '10px' : '0'};">
              <span style="color:#22c55e;font-weight:700;font-size:13px;min-width:16px;">${i + 1}.</span>
              <p style="margin:0;color:#86efac;font-size:13px;line-height:1.5;">${tip}</p>
            </div>`).join('')}
        </div>
      </td></tr>

      <!-- Example better answer -->
      <tr><td style="background:#1a1712;padding:0 32px 24px;border-left:1px solid #2a251d;border-right:1px solid #2a251d;">
        <div style="background:#14110d;border:1px solid #2a251d;border-radius:12px;padding:20px;">
          <p style="margin:0 0 12px;color:#FF5A1F;font-size:13px;font-weight:600;">Example Better Answer</p>
          <p style="margin:0;color:#d8d0c2;font-size:13px;line-height:1.7;white-space:pre-wrap;">${exampleBetterAnswer}</p>
        </div>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#0b0906;border:1px solid #2a251d;border-radius:0 0 16px 16px;padding:20px 32px;text-align:center;">
        <p style="margin:0 0 4px;color:#8a8275;font-size:12px;">Generated by <strong style="color:#FF5A1F;">Runback</strong> ◀◀</p>
        <p style="margin:0;color:#6b6355;font-size:11px;">Run it back till it's easy.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`

    await transporter.sendMail({
      from: `"Runback" <${process.env.GMAIL_USER}>`,
      to,
      subject: `Your Runback interview results — ${company} ${role}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Email error:', err)
    return NextResponse.json({ error: err.message || 'Failed to send email' }, { status: 500 })
  }
}
