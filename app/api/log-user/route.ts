import { NextRequest, NextResponse } from 'next/server'

const AIRTABLE_TABLE = 'Signups'

export async function POST(req: NextRequest) {
  try {
    const { firstName, email, interviewType, company, role } = await req.json()

    if (!firstName || !email || !company || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const apiKey = process.env.AIRTABLE_API_KEY
    const baseId = process.env.AIRTABLE_BASE_ID

    // Gracefully skip if credentials not yet configured
    if (!apiKey || !baseId || apiKey === 'YOUR_AIRTABLE_API_KEY') {
      return NextResponse.json({ success: true, skipped: true })
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(AIRTABLE_TABLE)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            Timestamp:       new Date().toISOString(),
            'First Name':    firstName,
            Email:           email,
            'Interview Type': interviewType || 'General',
            Company:         company,
            Role:            role,
            Returned:        false,
          },
        }),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Airtable error ${res.status}: ${body}`)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Log user error:', err)
    // Never block the user flow on analytics failure
    return NextResponse.json({ success: true, error: err.message })
  }
}
