"use client";
import { useRouter } from "next/navigation";
import AuthModal from "@/components/AuthModal";

export default function LoginPage() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <AuthModal
        onClose={() => {
          router.push("/");
        }}
      />
    </div>
  );
}