import { CoachLink as Link } from "@/components/coaching/CoachLink";
import { useId, useRef, useState } from "react";
import { filterSampleClients, SAMPLE_CLIENTS, SAMPLE_ROSTER_DATE, SAMPLE_ROSTER_TOTAL, type ClientFilter } from "@/lib/coaching/dashboard";
import styles from "./dashboard.module.css";

export function SampleClients({ overview = false }: { overview?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const clientButtons = useRef(new Map<string, HTMLButtonElement>());
  const id = useId();
  const shown = filterSampleClients(SAMPLE_CLIENTS, query, filter);
  const selected = shown.find((client) => client.id === selectedId);
  function closeDetails() {
    const button = selectedId ? clientButtons.current.get(selectedId) : null;
    setSelectedId(null);
    button?.focus();
  }

  return (
    <section className={styles.panel} aria-label="Current sample clients">
      <div className={styles.panelHead}>
        <div>
          <h2>{overview ? "Your clients" : "Current client roster"}</h2>
          <p className={styles.description}>Sample roster · {SAMPLE_ROSTER_TOTAL} enrolled · {SAMPLE_ROSTER_DATE}</p>
        </div>
        {overview && <Link href="/coaching/clients" className={styles.textLink}>View all <span aria-hidden="true">↗</span></Link>}
      </div>
      <p className={styles.rosterNote}>Current as of {SAMPLE_ROSTER_DATE}, independent of the reporting period. Four fictional client examples are available to explore.</p>
      <div className={styles.clientTools}>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search sample clients by name or plan</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg>
          <input type="search" value={query} aria-label="Search sample clients by name or plan" placeholder="Find a client or plan" onChange={(event) => { setQuery(event.target.value); setSelectedId(null); }} />
        </label>
        <div className={styles.filters} role="group" aria-label="Filter sample clients by status">
          <button type="button" aria-pressed={filter === "all"} onClick={() => { setFilter("all"); setSelectedId(null); }}>All</button>
          <button type="button" aria-pressed={filter === "attention"} onClick={() => { setFilter("attention"); setSelectedId(null); }}>Needs attention</button>
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        {selected && (
          <section className={styles.clientDetail} id={`${id}-details`} aria-label={`${selected.name} sample details`}>
            <div><h3>{selected.name}</h3><p>{selected.plan} · sample enrollment</p><p>{selected.completed} of {selected.sessions} sessions completed. {selected.note}</p><p>{selected.status} · activity as of October 19</p></div>
            <button type="button" className={styles.closeButton} onClick={closeDetails} aria-label="Close client details"><span aria-hidden="true">×</span></button>
          </section>
        )}
      </div>
      {shown.length ? (
        <table className={styles.clientTable}>
          <caption className={styles.srOnly}>Fictional current clients as of {SAMPLE_ROSTER_DATE}</caption>
          <thead><tr><th scope="col">Client / plan</th><th scope="col">Progress</th><th scope="col">Status</th><th scope="col">Last activity</th></tr></thead>
          <tbody>
            {shown.map((client) => (
              <tr key={client.id}>
                <td>
                  <button type="button" className={styles.nameButton} ref={(button) => { if (button) clientButtons.current.set(client.id, button); else clientButtons.current.delete(client.id); }} aria-label={`View ${client.name} sample details`} aria-expanded={selected?.id === client.id} aria-controls={selected?.id === client.id ? `${id}-details` : undefined} onClick={() => setSelectedId(selectedId === client.id ? null : client.id)}>
                    <span className={styles.avatar} aria-hidden="true">{client.initials}</span>
                    <span><span className={styles.personName}>{client.name}</span><span className={styles.personPlan}>{client.plan}</span></span>
                  </button>
                </td>
                <td className={styles.clientProgress}>Week {client.week} of {client.weeks}<div className={styles.progress} role="progressbar" aria-label={`${client.name} sessions completed`} aria-valuenow={client.completed} aria-valuemin={0} aria-valuemax={client.sessions} aria-valuetext={`${client.completed} of ${client.sessions} sessions`}><span style={{ width: `${client.completed / client.sessions * 100}%` }} /></div></td>
                <td className={styles.clientStatus}><span className={`${styles.status} ${client.status !== "On track" ? styles.attention : ""}`}>{client.status}</span></td>
                <td className={styles.activity}>{client.activity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className={styles.empty}>No sample clients match your search and filter.</p>}
      <p className={styles.tableFooter} role="status">Showing {shown.length} of 4 sample examples{filter === "attention" ? " · behind or not started" : ""}{query.trim() ? ` · matching “${query.trim()}”` : ""}</p>
    </section>
  );
}
