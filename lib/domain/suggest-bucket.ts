import type { Bucket } from "./buckets";

// Keywords straight from design.md D6, plus a few obvious extras per bucket.
const KEYWORD_BUCKETS: Record<string, Bucket> = {
  mercado: "needs",
  supermercado: "needs",
  acougue: "needs",
  farmacia: "needs",
  aluguel: "needs",
  condominio: "needs",
  luz: "needs",
  energia: "needs",
  agua: "needs",
  internet: "needs",
  transporte: "needs",
  combustivel: "needs",
  ifood: "wants",
  cinema: "wants",
  bar: "wants",
  restaurante: "wants",
  show: "wants",
  streaming: "wants",
  viagem: "wants",
  roupa: "wants",
  tesouro: "savings",
  cdb: "savings",
  reserva: "savings",
  investimento: "savings",
  poupanca: "savings",
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Suggests a bucket from keywords found in a free-form description.
 * Case- and accent-insensitive ("Açougue" matches "acougue"). Returns
 * `null` when no keyword matches.
 */
export function suggestBucket(description: string): Bucket | null {
  const words = normalize(description).split(/\W+/).filter(Boolean);

  for (const word of words) {
    const bucket = KEYWORD_BUCKETS[word];
    if (bucket) return bucket;
  }

  return null;
}
