import type { Metadata } from "next";
import { Suspense } from "react";
import { describeRequest } from "@/lib/domain";
import { requireUser } from "@/lib/session";
import { listRequests } from "@/lib/store";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = { title: "Meu acesso · Onboardinho" };

export default function MeuAcessoPage() {
  return (
    <Suspense fallback={null}>
      <Flow />
    </Suspense>
  );
}

async function Flow() {
  const user = await requireUser();
  const pending = (await listRequests()).find(
    (r) => r.userId === user.id && r.status === "pendente",
  );

  return (
    <OnboardingFlow
      mode="meu-acesso"
      user={user}
      pendingRequest={pending ? describeRequest(pending) : null}
    />
  );
}
