"use client";
import { signOutCoach } from "@/app/coaching/(hub)/actions";
import { AuthBoundaryForm } from "@/components/auth/AuthBoundaryForm";
export function CoachSignOut({ className, buttonClassName }: { className?: string; buttonClassName?: string }) {
  return <AuthBoundaryForm action={signOutCoach} className={className}><button className={buttonClassName}>Sign out</button></AuthBoundaryForm>;
}
