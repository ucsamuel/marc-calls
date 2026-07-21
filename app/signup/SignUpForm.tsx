'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SignUpForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!photo) {
      setError('A profile photo is required.')
      return
    }

    setLoading(true)

    try {
      const { count: adminCount } = await supabase
        .from('admins')
        .select('id', { count: 'exact', head: true })

      const isFirstAdmin = (adminCount || 0) === 0

      if (!isFirstAdmin) {
        if (!inviteToken) {
          setError('An invite link is required to create an account.')
          setLoading(false)
          return
        }

        const { data: invite } = await supabase
          .from('admin_invites')
          .select('id, used')
          .eq('token', inviteToken)
          .single()

        if (!invite || invite.used) {
          setError('This invite link is invalid or has already been used.')
          setLoading(false)
          return
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (authError) throw authError

      const fileExt = photo.name.split('.').pop()
      const fileName = `${authData.user?.id}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('admin-photos')
        .upload(fileName, photo)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('admin-photos')
        .getPublicUrl(fileName)

      const { error: insertError } = await supabase.from('admins').insert({
        id: authData.user?.id,
        name,
        phone,
        email,
        photo_url: urlData.publicUrl,
        is_primary: isFirstAdmin,
      })

      if (insertError) throw insertError

      if (!isFirstAdmin && inviteToken) {
        await supabase
          .from('admin_invites')
          .update({ used: true, used_by: authData.user?.id })
          .eq('token', inviteToken)
      }

      router.push('/home')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F6] dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-8">
        <h1 className="font-serif text-2xl text-[#0B1F3A] dark:text-white text-center">
          Create admin account
        </h1>
        <div className="w-16 h-[2px] bg-[#C9A227] mx-auto my-4" />

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div>
            <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Full name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white"
              placeholder="Enter your full Name"
            />
          </div>

          <div>
            <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Phone number</label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white"
              placeholder="Enter your phone Number"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Used to identify you in the app — you'll log in with your email.</p>
          </div>

          <div>
            <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-12 px-4 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white"
              placeholder="you@example.com"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only used if you forget your password.</p>
          </div>

          <div>
            <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-[#C9A227] text-[#0B1F3A] dark:text-white"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-[#0B1F3A] dark:text-white mb-1">Profile photo</label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="w-full text-sm text-[#0B1F3A] dark:text-white"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-lg bg-[#0B1F3A] dark:bg-[#C9A227] text-white dark:text-[#0B1F3A] font-medium mt-2 disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-6">
          Already have an account?{' '}
          <a href="/login" className="text-[#0B1F3A] dark:text-[#C9A227] font-medium underline">
            Log in
          </a>
        </p>
      </div>
    </div>
  )
}