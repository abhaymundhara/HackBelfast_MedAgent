import { DashboardMock } from "@/components/landing/dashboard-mock";
import { PhoneDemo } from "@/components/landing/phone-demo";

export function ShowcaseOverlap() {
  return (
    <div className="showcase-overlap">
      <div className="showcase-overlap-dash">
        <DashboardMock />
      </div>
      <div className="showcase-overlap-phone">
        <PhoneDemo />
      </div>
    </div>
  );
}
