// Vertrags-Klassifikation für den Spar-Wasserfall (#160-Erweiterung):
// erkennt wiederkehrende Verträge anhand des Namens und ordnet KLAR kündbaren,
// diskretionären Abos eine niedrige Priorität zu — damit sie beim Sparen zuerst
// vorgeschlagen werden. Lebensnotwendige/komplexe Verträge (Versicherung,
// Energie, Mobilfunk) werden bewusst NICHT als „einfach kündbar" angeboten;
// dafür gibt es die Anbietervergleich-Hinweise im Verträge-Tab.

import type { Prioritaet } from "@/types";

export interface ContractDomainSpec {
  domain: string;
  keywords: string[];
}

export const CONTRACT_DOMAINS: ContractDomainSpec[] = [
  { domain: "Streaming", keywords: ["streaming", "netflix", "spotify", "prime", "disney", "dazn", "sky", "audible", "youtube", "wow", "paramount", "apple tv", "crunchyroll", "deezer"] },
  { domain: "Fitness", keywords: ["fitness", "fitnessstudio", "gym", "mcfit", "urban sports", "clever fit", "sportstudio", "mitgliedschaft"] },
  { domain: "Versicherung", keywords: ["versicherung", "haftpflicht", "hausrat", "krankenkasse", "kfz", "rechtsschutz", "lebensversicherung"] },
  { domain: "Telekommunikation", keywords: ["mobilfunk", "internet", "telekom", "vodafone", "o2", "handy", "dsl", "tarif"] },
  { domain: "Energie", keywords: ["strom", "gas", "energie", "stadtwerke"] },
];

/** Erkennt die Vertrags-Domäne aus einem Fluss-/Buchungsnamen. */
export function matchContractDomain(name: string): string | null {
  const n = (name ?? "").toLowerCase();
  for (const d of CONTRACT_DOMAINS) {
    if (d.keywords.some((k) => n.includes(k))) return d.domain;
  }
  return null;
}

/**
 * Nur eindeutig kündbare Abos werden mit Priorität in den Spar-Wasserfall
 * gegeben (Streaming/Fitness → „nice", also zuerst weg). Alles andere liefert
 * `null` und wird damit NICHT als kürzbarer Posten vorgeschlagen.
 */
const CANCELLABLE_CONTRACT_PRIORITY: Record<string, Prioritaet> = {
  Streaming: "nice",
  Fitness: "nice",
};

export function classifyContractPriority(name: string): Prioritaet | null {
  const domain = matchContractDomain(name);
  if (!domain) return null;
  return CANCELLABLE_CONTRACT_PRIORITY[domain] ?? null;
}
