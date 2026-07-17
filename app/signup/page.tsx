'use client'

import { Suspense } from 'react'
import SignUpForm from './SignUpForm'

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF9F6] dark:bg-gray-900" />}>
      <SignUpForm />
    </Suspense>
  )
}