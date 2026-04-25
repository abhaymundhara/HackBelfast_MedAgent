import { getIssuerByRequesterId, listIssuerRegistry } from "@/lib/db";
import { getDemoClinician } from "@/lib/ips/seed";
import { VerificationResult, VerificationTrustLevel } from "@/lib/types";

function findCredentialIssuerHint(presentedCredential?: string) {
  if (!presentedCredential) {
    return null;
  }

  const normalized = presentedCredential.toLowerCase();
  return (
    listIssuerRegistry().find(
      (entry) =>
        entry.trusted === 1 &&
        [entry.issuer_label, entry.issuer_id, entry.requester_label, entry.requester_id]
          .filter(Boolean)
          .some((value) => normalized.includes(value.toLowerCase())),
    ) ?? null
  );
}

export async function verifyRequester(input: {
  requesterId: string;
  presentedCredential?: string;
}): Promise<VerificationResult> {
  const registryEntry = getIssuerByRequesterId(input.requesterId);
  const persona = getDemoClinician(input.requesterId);
  const credentialIssuerHint = findCredentialIssuerHint(input.presentedCredential);

  const requesterLabel =
    registryEntry?.requester_label ??
    persona?.requesterLabel ??
    "Unrecognized requester";
  const issuerLabel =
    registryEntry?.issuer_label ??
    credentialIssuerHint?.issuer_label ??
    persona?.issuerLabel ??
    "Unknown issuer";

  const verified = Boolean(registryEntry?.trusted);
  const registryAnchored = Boolean(registryEntry || credentialIssuerHint);
  const registryAccountId =
    registryEntry?.registry_account_id ?? credentialIssuerHint?.registry_account_id ?? null;

  let trustLevel: VerificationTrustLevel = "unknown_requester";
  let verificationReason =
    "Requester is not recognized in the trusted registry and no credential evidence was provided.";

  if (verified) {
    trustLevel = "trusted_requester";
    verificationReason =
      "Requester matches a trusted registry entry anchored to the Barcelona demo issuer set.";
  } else if (credentialIssuerHint) {
    trustLevel = "trusted_issuer_unrecognized_requester";
    verificationReason =
      "A credential references a trusted issuer, but the requester is not a strongly verified registry match for auto-access.";
  } else if (registryEntry) {
    trustLevel = "known_untrusted_issuer";
    verificationReason =
      "Requester is known to the demo registry, but that issuer/requester path is not trusted for Tier 1 auto-access.";
  } else if (input.presentedCredential) {
    trustLevel = "credential_presented_untrusted";
    verificationReason =
      "A credential was presented, but it does not map to a trusted issuer or requester in the demo registry.";
  }

  return {
    verified,
    issuerLabel,
    requesterLabel,
    trustLevel,
    verificationMode:
      registryEntry?.verification_mode ??
      (credentialIssuerHint ? "credential_hint" : "unknown"),
    verificationReason,
    registryAnchored,
    registryAccountId,
    presentedCredential: Boolean(input.presentedCredential),
    reason: verificationReason,
  };
}
