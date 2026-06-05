"use client";

import { useState } from "react";

/**
 * Chip editor for a string[] field. Serializes to a hidden input named `name`
 * as newline-joined text, which `parseList` (server) splits back into an array.
 */
export function ArrayField({
  name,
  label,
  defaultValue = [],
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string[];
  placeholder?: string;
}) {
  const [items, setItems] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  function add() {
    const v = draft.trim();
    if (v && !items.includes(v)) setItems([...items, v]);
    setDraft("");
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm text-zinc-300">{label}</label>
      <input type="hidden" name={name} value={items.join("\n")} />
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs"
          >
            {item}
            <button
              type="button"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              className="text-zinc-400 hover:text-red-400"
              aria-label={`Remove ${item}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-emerald-600"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-zinc-800 px-3 text-sm"
        >
          Add
        </button>
      </div>
    </div>
  );
}
