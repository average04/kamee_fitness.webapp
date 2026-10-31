export default function LoadingCoachWorkspace() {
  return (
    <section className="coach-page-loading" aria-label="Loading coach workspace">
      <p className="coach-loading-announcement" role="status">Loading…</p>
      <div className="coach-loading-placeholder" aria-hidden="true">
        <div className="coach-loading-title" />
        <div className="coach-loading-subtitle" />
        <div className="coach-loading-panels">
          <div className="coach-loading-panel"><div /><div /><div /></div>
          <div className="coach-loading-panel"><div /><div /><div /></div>
        </div>
      </div>
    </section>
  );
}
