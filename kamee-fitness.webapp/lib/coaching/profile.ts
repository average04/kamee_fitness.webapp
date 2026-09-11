/**
 * Pure form parsing/validation for the Coaching Hub profile + credentials
 * forms. No I/O, no Supabase — Server Actions call these, then write via the
 * privileged RPCs. Keeping these pure makes them trivially unit-testable.
 */

export type ProfileInput = {
  headline: string;
  about: string;
  specialties: string[];
  yearsExperience: number | null;
  languages: string[];
  locationLabel: string;
  socials: { instagram?: string; website?: string };
  isAcceptingClients: boolean;
  responseDays: number;
  termsAccepted: boolean;
};

export type CredentialInput = {
  title: string;
  issuer: string;
  issuedYear: number | null;
  expiresOn: string | null;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

export type FormState = {
  errors?: Record<string, string>;
  message?: string;
  savedAt?: string;
};

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function list(fd: FormData, key: string): string[] {
  const v = fd.get(key);
  if (typeof v !== "string") return [];
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function num(fd: FormData, key: string): number | null {
  const v = fd.get(key);
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function checkbox(fd: FormData, key: string): boolean {
  return fd.get(key) === "on";
}

export function parseProfileForm(fd: FormData): ProfileInput {
  const instagram = str(fd, "instagram");
  const website = str(fd, "website");
  const socials: ProfileInput["socials"] = {};
  if (instagram) socials.instagram = instagram;
  if (website) socials.website = website;

  return {
    headline: str(fd, "headline"),
    about: str(fd, "about"),
    specialties: list(fd, "specialties"),
    yearsExperience: num(fd, "years_experience"),
    languages: list(fd, "languages"),
    locationLabel: str(fd, "location_label"),
    socials,
    isAcceptingClients: checkbox(fd, "is_accepting_clients"),
    responseDays: num(fd, "response_days") ?? 3,
    termsAccepted: checkbox(fd, "terms_accepted"),
  };
}

export function validateProfile(i: ProfileInput): ValidationResult<ProfileInput> {
  const errors: Record<string, string> = {};

  if (i.headline.length > 80) {
    errors.headline = "Headline must be 80 characters or fewer.";
  }
  if (i.about.length > 2000) {
    errors.about = "About must be 2000 characters or fewer.";
  }
  if (i.specialties.length > 8) {
    errors.specialties = "Choose up to 8 specialties.";
  }
  if (i.languages.length > 6) {
    errors.languages = "Choose up to 6 languages.";
  }
  if (i.locationLabel.length > 80) {
    errors.locationLabel = "Location must be 80 characters or fewer.";
  }
  if (
    i.yearsExperience !== null &&
    (i.yearsExperience < 0 || i.yearsExperience > 60)
  ) {
    errors.yearsExperience = "Years of experience must be between 0 and 60.";
  }
  if (i.responseDays < 1 || i.responseDays > 7) {
    errors.responseDays = "Typical response time must be between 1 and 7 days.";
  }
  if (i.socials.website && !i.socials.website.startsWith("https://")) {
    errors.website = "Website must start with https://.";
  }
  if (i.socials.instagram && i.socials.instagram.length > 40) {
    errors.instagram = "Instagram handle must be 40 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: i };
}

export function parseCredentialForm(fd: FormData): CredentialInput {
  return {
    title: str(fd, "title"),
    issuer: str(fd, "issuer"),
    issuedYear: num(fd, "issued_year"),
    expiresOn: str(fd, "expires_on") || null,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateCredential(
  i: CredentialInput,
): ValidationResult<CredentialInput> {
  const errors: Record<string, string> = {};

  if (i.title.length < 1 || i.title.length > 120) {
    errors.title = "Title is required (up to 120 characters).";
  }
  if (i.issuer.length < 1 || i.issuer.length > 120) {
    errors.issuer = "Issuer is required (up to 120 characters).";
  }
  if (
    i.issuedYear !== null &&
    (i.issuedYear < 1950 || i.issuedYear > 2100)
  ) {
    errors.issuedYear = "Issued year must be between 1950 and 2100.";
  }
  if (i.expiresOn !== null && !DATE_RE.test(i.expiresOn)) {
    errors.expiresOn = "Expiry date must be in YYYY-MM-DD format.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: i };
}

/** Copy for the "what's missing" checklist, keyed by what the approval RPC reports. */
export const MISSING_LABELS: Record<string, string> = {
  headline: "Add a headline",
  about: "Write at least 80 characters about yourself",
  avatar: "Set a profile photo in the Kamee app",
  cover: "Upload a cover photo",
  credential: "Add at least one credential",
  gallery: "Add at least 3 gallery photos",
  terms: "Accept the coach terms",
};
