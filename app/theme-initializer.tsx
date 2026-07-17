'use client'

import { useEffect } from 'react'
import { getStoredTheme, applyTheme } from '@/lib/theme'

export default function ThemeInitializer() {
  useEffect(() => {
    applyTheme(getStoredTheme())
  }, [])

  return null
}