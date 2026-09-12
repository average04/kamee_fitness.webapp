"use client";
import { useEffect } from "react";
import { signOutCoach } from "@/app/coaching/(hub)/actions";

function clearRecovery() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("coaching-draft:")) sessionStorage.removeItem(key);
    }
  } catch {
    console.warn("Browser storage prevented clearing coaching recovery copies.");
  }
}
export function CoachSignOut({ className, buttonClassName }: { className?: string; buttonClassName?: string }) {
  useEffect(() => {
    const channel = new BroadcastChannel("coaching-signout");
    channel.onmessage = clearRecovery;
    return () => channel.close();
  }, []);
  return <form action={signOutCoach} className={className} onSubmit={() => {
    clearRecovery();
    const channel = new BroadcastChannel("coaching-signout");
    channel.postMessage("signed-out");
    channel.close();
  }}><button className={buttonClassName}>Sign out</button></form>;
}
