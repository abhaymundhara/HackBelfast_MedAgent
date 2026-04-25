import { SiteFooter } from "@/components/landing/site-footer";
import { AnimatedNav } from "@/components/landing/animated-nav";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="landing-root">
      <AnimatedNav />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}
