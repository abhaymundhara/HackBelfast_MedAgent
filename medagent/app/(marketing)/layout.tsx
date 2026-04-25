import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="landing-root">
      <SiteNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
