const DEFAULT_APPOINTMENT_SHARE_EMAIL = "gulsameer1000@gmail.com";

export type AppointmentShareEmailResult = {
  sent: boolean;
  to: string;
  error?: string;
};

export function getAppointmentShareEmailRecipient() {
  return (
    process.env.APPOINTMENT_SHARE_EMAIL_TO?.trim() ||
    DEFAULT_APPOINTMENT_SHARE_EMAIL
  );
}

export async function sendAppointmentShareLinkEmail(input: {
  doctorName: string;
  shareUrl: string;
  patientId: string;
}): Promise<AppointmentShareEmailResult> {
  const to = getAppointmentShareEmailRecipient();
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@medagent.dev";

  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured; appointment share email not sent", {
      to,
      patientId: input.patientId,
    });
    console.log(`[DEV] Appointment share link for ${input.doctorName}: ${input.shareUrl}`);
    return { sent: false, to, error: "RESEND_API_KEY not configured" };
  }

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const response = await resend.emails.send({
      from: fromEmail,
      to,
      subject: `MedAgent record link for ${input.doctorName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
          <h2>MedAgent record share</h2>
          <p>The patient approved sharing their medical record with ${input.doctorName} for this appointment.</p>
          <p><a href="${input.shareUrl}">Open the doctor's record link</a></p>
          <p style="word-break: break-all; color: #334155;">${input.shareUrl}</p>
          <p style="color: #64748b; font-size: 13px;">This link contains an access token. Only forward it to the intended clinician.</p>
        </div>
      `,
    });
    if (response.error) {
      const message =
        response.error.message ??
        `Resend rejected the email with status ${response.error.statusCode ?? "unknown"}`;
      console.error("Failed to send appointment share email:", message);
      return { sent: false, to, error: message };
    }
    return { sent: true, to };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to send appointment share email:", message);
    return { sent: false, to, error: message };
  }
}
