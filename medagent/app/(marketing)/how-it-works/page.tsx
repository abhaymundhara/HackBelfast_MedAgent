import Link from "next/link";

import { AnimatedWorkflow } from "@/components/landing/animated-workflow";
import { AnimatedHowItWorksContent } from "@/components/landing/animated-how-it-works";

export const metadata = {
  title: "How it works — MedAgent",
};

export default function HowItWorksPage() {
  return (
    <>
      <AnimatedHowItWorksContent />

      <section className="sec wf-sec">
        <div className="container">
          <div className="sec-head">
            <span className="eyebrow">The three stages</span>
            <h2 className="display-md">Request &rarr; Consent &rarr; Audit.</h2>
          </div>
          <AnimatedWorkflow />
        </div>
      </section>

      <section className="cta-final">
        <div className="container">
          <h2 className="display-md">Try it live.</h2>
          <p>
            The whole thing runs over the messaging app already on your phone.
          </p>
          <div className="actions">
            <Link
              className="btn btn-primary btn-lg"
              href="sms:+447700900099?body=Emergency%20access%20request"
            >
              Text MedAgent
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/use-cases">
              See use cases
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
