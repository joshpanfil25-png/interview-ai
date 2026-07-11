import type { Metadata } from 'next'
import HowItWorksClient from './how-it-works-client'

export const metadata: Metadata = {
  title: 'How It Works — Interview AI',
  description:
    'See exactly what happens in a practice interview — six tailored questions, instant feedback after every answer, and a full report on what to improve. Free, no account needed.',
}

export default function HowItWorksPage() {
  return <HowItWorksClient />
}
