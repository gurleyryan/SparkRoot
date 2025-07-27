'use client'
import Recovery from '@/components/Recovery'

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-xl shadow-lg">
        <Recovery />
      </div>
    </div>
  )
}