export function PageIntro({ title, description }: {
  title: string; description?: string;
}) {
  return <header className="coach-page-intro">
    <h1>{title}</h1>
    {description && <p className="coach-page-description">{description}</p>}
  </header>;
}
