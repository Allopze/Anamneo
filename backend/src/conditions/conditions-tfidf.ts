type IndexedDocument = {
  totalTerms: number;
  termCounts: Map<string, number>;
};

export class ConditionsTfIdf {
  private readonly documents: IndexedDocument[] = [];
  private readonly documentFrequencies = new Map<string, number>();

  addDocument(text: string) {
    const tokens = tokenize(text);
    const termCounts = new Map<string, number>();

    for (const token of tokens) {
      termCounts.set(token, (termCounts.get(token) ?? 0) + 1);
    }

    for (const token of new Set(tokens)) {
      this.documentFrequencies.set(token, (this.documentFrequencies.get(token) ?? 0) + 1);
    }

    this.documents.push({
      totalTerms: tokens.length,
      termCounts,
    });
  }

  scoreDocument(index: number, query: string) {
    const document = this.documents[index];
    if (!document || document.totalTerms === 0) {
      return 0;
    }

    const queryTokens = new Set(tokenize(query));
    if (queryTokens.size === 0) {
      return 0;
    }

    let score = 0;

    for (const token of queryTokens) {
      const termCount = document.termCounts.get(token);
      if (!termCount) {
        continue;
      }

      const tf = termCount / document.totalTerms;
      const documentFrequency = this.documentFrequencies.get(token) ?? 0;
      const idf = Math.log((this.documents.length + 1) / (documentFrequency + 1)) + 1;
      score += tf * idf;
    }

    return score;
  }
}

function tokenize(text: string) {
  return text.split(/\s+/).filter(Boolean);
}