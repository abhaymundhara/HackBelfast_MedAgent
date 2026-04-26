export const metadata = {
  title: "MedAgent Portal",
  description: "Patient portal — futuristic dashboard prototype.",
};

export default function PortalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="landing-root portal-root">
      <div className="portal-bg" aria-hidden="true">
        <div className="portal-bg-grid" />
        <div className="portal-bg-glow portal-bg-glow-1" />
        <div className="portal-bg-glow portal-bg-glow-2" />
      </div>
      <main className="portal-main">{children}</main>
    </div>
  );
}
