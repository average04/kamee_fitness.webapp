import "@/app/coaching/workspace.css";
export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="coaching-workspace plan-stack">{children}</div>;
}
