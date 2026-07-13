import type { Metadata } from 'next'
import HowItWorksClient from './how-it-works-client'

export const metadata: Metadata = {
  title: 'How It Works — Runback',
  description:
    'What happens in a Runback mock interview, step by step — six questions built from your resume and target role, instant feedback after every answer, and a full scored report. Free for students.',
}

export default function HowItWorksPage() {
  return <HowItWorksClient />
}
