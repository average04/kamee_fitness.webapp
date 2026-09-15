"use client";
import { useId, useRef, useState } from "react";
import type { ExerciseOption } from "@/lib/coaching/plans";

export function ExercisePicker({ exercises, onAdd }: { exercises: ExerciseOption[]; onAdd: (id: string) => void }) {
  const id = useId();
  const list = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState(-1);
  const [added, setAdded] = useState("");
  const matches = exercises.filter(e => e.name.toLowerCase().includes(search.trim().toLowerCase()));
  const options = matches.slice(0, 40);
  function select(exercise: ExerciseOption) {
    onAdd(exercise.id);
    setAdded(`${exercise.name} added.`);
    setSearch(""); setActive(-1); setOpen(false);
  }
  function highlight(index: number) {
    setActive(index);
    list.current?.children[index]?.scrollIntoView({ block: "nearest" });
  }
  return <div className="plan-combobox">
    <label className="plan-field" htmlFor={id}>Add exercise</label>
    <input id={id} className="coach-input" role="combobox" autoComplete="off"
      aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-list`}
      aria-activedescendant={open && active >= 0 && options[active] ? `${id}-option-${active}` : undefined}
      placeholder="Search exercises..." value={search}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onChange={e => { setSearch(e.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={e => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault(); setOpen(true);
          if (options.length) highlight(e.key === "ArrowDown" ? Math.min(active + 1, options.length - 1) : Math.max(active - 1, 0));
        } else if (e.key === "Enter" && open) {
          e.preventDefault(); if (options[active]) select(options[active]);
        } else if (e.key === "Escape") { e.preventDefault(); setOpen(false); setActive(-1); }
      }} />
    <div className="plan-combobox-popup" hidden={!open}>
      <ul id={`${id}-list`} ref={list} role="listbox" aria-label="Exercises">
        {options.map((exercise, index) => <li key={exercise.id} id={`${id}-option-${index}`}
          role="option" aria-selected={active === index} onMouseDown={e => e.preventDefault()}
          onClick={() => select(exercise)}>{exercise.name}</li>)}
      </ul>
      {!options.length && <p role="status">No matches. Try another exercise name.</p>}
      {matches.length > 40 && <p className="coach-panel-description">Keep typing to narrow {matches.length} exercises.</p>}
    </div>
    <span role="status" className="sr-only">{added}</span>
  </div>;
}
