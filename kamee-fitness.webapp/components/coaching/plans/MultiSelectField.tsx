"use client";
import { useId, useState } from "react";

/** Controlled selections; unknown existing values remain available and removable. */
export function MultiSelectField({ label, hint, value, options, onChange, labels = {} }: {
  labels?: Record<string, string>;
  label: string; hint: string; value: string[]; options: readonly string[];
  onChange: (value: string[]) => void;
}) {
  const id = useId();
  const display = (v: string) => labels[v] ?? v;
  const [query, setQuery] = useState("");
  const choices = [...new Set([...value, ...options])];
  const filtered = choices.filter(v => display(v).toLowerCase().includes(query.trim().toLowerCase()));
  const custom = query.trim().replace(/,/g, " ").trim();
  function addCustom() {
    if (!custom) return;
    if (!choices.some(v => v.toLowerCase() === custom.toLowerCase())) onChange([...value, custom]);
    setQuery("");
  }
  return <fieldset className="plan-multiselect" aria-describedby={`${id}-hint`}>
    <legend>{label}</legend>
    <p id={`${id}-hint`} className="coach-panel-description">{hint}</p>
    {value.length > 0 && <div className="plan-selected-tags">
      {value.map(item => <button type="button" key={item} aria-label={`Remove ${display(item)} from ${label}`}
        onClick={() => onChange(value.filter(v => v !== item))}>{display(item)}<span aria-hidden="true"> ×</span></button>)}
    </div>}
    <details className="plan-selection-menu">
      <summary>{value.length ? `Edit selections (${value.length})` : `Choose ${label.toLowerCase()}`}</summary>
      <label className="plan-field" htmlFor={id}><span>Search or add your own</span></label>
      <div className="flex gap-2">
        <input id={id} className="coach-input" value={query} maxLength={80} placeholder={`Search ${label.toLowerCase()}`} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} />
        <button type="button" className="plan-secondary" disabled={!custom || choices.some(v => v.toLowerCase() === custom.toLowerCase())} onClick={addCustom}>Add</button>
      </div>
      <div className="plan-selection-options">
        {filtered.map(item => <label key={item}>
          <input type="checkbox" checked={value.includes(item)} onChange={e => onChange(e.target.checked ? [...value, item] : value.filter(v => v !== item))} />
          <span>{display(item)}</span>
        </label>)}
      </div>
      {filtered.length === 0 && <p className="coach-panel-description">No matching choices. Use Add for a custom value.</p>}
    </details>
  </fieldset>;
}
