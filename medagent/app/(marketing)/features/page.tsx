import Link from "next/link";

import { AnimatedFeaturesContent } from "@/components/landing/animated-features";

export const metadata = {
  title: "Features — MedAgent",
};

export default function FeaturesPage() {
  return (
    <>
      <AnimatedFeaturesContent />

      <section className="cta-final">
        <div className="container">
          <h2 className="display-md">See it on your phone.</h2>
          <div className="actions">
            <Link
              className="btn btn-primary btn-lg"
              href="sms:+447700900099?body=Emergency%20access%20request"
            >
              Text MedAgent
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/use-cases">
              Use cases
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
