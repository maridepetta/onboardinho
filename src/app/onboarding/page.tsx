import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentAccess, isScenario } from "@/lib/access";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

export const metadata: Metadata = {
  title: "Seu acesso · Trilho",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  // O acesso é por usuário, então a tela é sempre dinâmica.
  return (
    <Suspense fallback={null}>
      <Flow searchParams={searchParams} />
    </Suspense>
  );
}

async function Flow({ searchParams }: { searchParams: SearchParams }) {
  // `?cenario=` só existe enquanto os dados são simulados.
  const { cenario } = await searchParams;
  const scenario = isScenario(cenario) ? cenario : undefined;
  const access = await getCurrentAccess(scenario);

  return (
    <OnboardingFlow
      key={scenario ?? "padrao"}
      access={access}
      showScenarioSwitcher={process.env.NODE_ENV !== "production"}
    />
  );
}
