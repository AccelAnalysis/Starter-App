"use client";

import { useMemo, useState } from "react";
import { transformItems } from "@/lib/utility";

const SAMPLE = `Hampton
Norfolk
Virginia Beach
Hampton
Newport News`;

export function UtilityWorkbench() {
  const [raw, setRaw] = useState(SAMPLE);
  const [filter, setFilter] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [sort, setSort] = useState(true);

  const result = useMemo(
    () => transformItems(raw, { filter, dedupe, sort }),
    [raw, filter, dedupe, sort],
  );

  return (
    <section className="workbench" aria-labelledby="workbench-title">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Example workflow</p>
            <h2 id="workbench-title">Filter and transform a list</h2>
          </div>
          <span className="status-badge">Client-side only</span>
        </div>

        <label className="field">
          <span>Items — one per line</span>
          <textarea value={raw} onChange={(event) => setRaw(event.target.value)} rows={10} />
        </label>

        <label className="field">
          <span>Filter text</span>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Example: ham"
          />
        </label>

        <div className="option-row">
          <label className="check-field">
            <input type="checkbox" checked={dedupe} onChange={(event) => setDedupe(event.target.checked)} />
            Remove duplicates
          </label>
          <label className="check-field">
            <input type="checkbox" checked={sort} onChange={(event) => setSort(event.target.checked)} />
            Sort A–Z
          </label>
        </div>
      </div>

      <div className="panel result-panel" aria-live="polite">
        <div className="result-summary">
          <div>
            <span>Input</span>
            <strong>{result.inputCount}</strong>
          </div>
          <div>
            <span>Output</span>
            <strong>{result.outputCount}</strong>
          </div>
        </div>

        <div className="result-list">
          {result.items.length ? (
            result.items.map((item) => <div className="result-item" key={item}>{item}</div>)
          ) : (
            <p className="empty-state">No items match the current filter.</p>
          )}
        </div>
      </div>
    </section>
  );
}
