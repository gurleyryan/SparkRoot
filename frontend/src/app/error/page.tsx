"use client";
import { useRouter } from "next/navigation";
import Image from 'next/image';

export default function ErrorPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-md p-8 bg-gray-900 rounded-xl shadow-lg flex flex-col items-center">
        <Image src="/logo.png" alt="SparkRoot Logo" className="mx-auto mb-4 h-64 w-64" width={640} height={640} />
        <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
        <p className="text-gray-300 mb-6 text-center">Sorry, an unexpected error occurred.<br />Please try again or return to the homepage.</p>
        <button
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition"
          onClick={() => router.push("/")}
        >
          Go Home
        </button>
      </div>
    </div>
  );
}