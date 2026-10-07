import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { describeRequest } from "@/lib/domain";
import { getCurrentUser } from "@/lib/session";
import { listRequests } from "@/lib/store";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = { title: "Primeiro acesso · Trilho" };

export default function PrimeiroAcessoPage() {
  return (
    <Suspense fallback={null}>
      <Flow />
    </Suspense>
  );
}

async function Flow() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (user.confirmedAt) redirect("/inicio");

  const pending = (await listRequests()).find(
    (r) => r.userId === user.id && r.status === "pendente",
  );

  return (
    <OnboardingFlow
      mode="primeiro-acesso"
      user={user}
      pendingRequest={pending ? describeRequest(pending) : null}
    />
  );
}
