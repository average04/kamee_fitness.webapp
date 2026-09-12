export function PageIntro({ eyebrow = "YOUR COACHING SPACE", title, description }: {
  eyebrow?: string; title: string; description: string;
}) {
  return <header className="coach-page-intro">
    <p className="coach-eyebrow">{eyebrow}</p>
    <h1>{title}</h1>
    <p className="coach-page-description">{description}</p>
  </header>;
}
