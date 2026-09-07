export type TransformOptions = {
  filter: string;
  dedupe: boolean;
  sort: boolean;
};

export type TransformResult = {
  inputCount: number;
  outputCount: number;
  items: string[];
};

export function transformItems(raw: string, options: TransformOptions): TransformResult {
  const input = raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  let items = [...input];
  const normalizedFilter = options.filter.trim().toLocaleLowerCase();

  if (normalizedFilter) {
    items = items.filter((item) => item.toLocaleLowerCase().includes(normalizedFilter));
  }

  if (options.dedupe) {
    const seen = new Set<string>();
    items = items.filter((item) => {
      const key = item.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  if (options.sort) {
    items.sort((a, b) => a.localeCompare(b));
  }

  return {
    inputCount: input.length,
    outputCount: items.length,
    items,
  };
}
