"use client";
import type { ComponentProps } from "react";
import { broadcastAuthBoundary } from "@/lib/auth-boundary";

/** Every server sign-out entry retires private client state before navigation. */
export function AuthBoundaryForm({ onSubmit, broadcastWhen, ...props }: ComponentProps<"form"> & { broadcastWhen?: (form: HTMLFormElement) => boolean }) {
  return <form {...props} onSubmit={event => { onSubmit?.(event); if (!event.defaultPrevented && (broadcastWhen?.(event.currentTarget) ?? true)) broadcastAuthBoundary(); }} />;
}
