import type { CopilotResultDTO } from '@educaro/shared';
import { Search, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { api, errorText } from '../api/client';
import { Button } from '../ui/Button';
import { EmptyState, PageHeader, Skeleton } from '../ui/misc';
import { RoleLabel } from '../ui/Tag';
import { toast } from '../ui/Toast';

const EXAMPLES = [
  'Nurses with B1 who can start September 2027',
  'Deadlines in the next 14 days',
  'Conflicts nobody has checked',
];

export default function CopilotPage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<CopilotResultDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (text: string) => {
    const value = text.trim();
    if (!value) return;
    setBusy(true);
    setQuery(value);
    try {
      setResult(await api.copilot(value));
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="Copilot">Ask in plain words. The filters run in code against the pipeline, and the agent explains how it read your question.</PageHeader>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(query);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Your question</span>
          <input
            className="input"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Who is ready for a Cologne nursing opening?"
            aria-label="Ask the copilot"
          />
        </label>
        <Button type="submit" variant="primary" icon={Search} loading={busy} disabled={!query.trim()}>
          Ask
        </Button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="chip" onClick={() => void ask(example)} disabled={busy}>
            {example}
          </button>
        ))}
      </div>

      <div className="mt-7">
        {busy ? (
          <Skeleton className="h-52 w-full" />
        ) : result ? (
          <section>
            <div className="mb-3">
              <RoleLabel role="agent">How I read your question</RoleLabel>
              <p className="mt-1.5 text-[14.5px]">{result.interpretation}</p>
            </div>
            {result.rows.length ? (
              <div tabIndex={0} className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col} scope="col">
                          {col}
                        </th>
                      ))}
                      <th scope="col" className="w-10">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i}>
                        {result.columns.map((col, c) => (
                          <td key={col} className={c === 0 ? 'font-semibold' : undefined}>
                            {row[col] ?? '—'}
                          </td>
                        ))}
                        <td>
                          {result.applicantIds[i] ? (
                            <Link to={`/staff/applicants/${result.applicantIds[i]}`} className="text-[12.5px] font-semibold">
                              Open
                            </Link>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Nobody matches that" icon={Search}>
                Try a wider question, or drop one of the conditions.
              </EmptyState>
            )}
            <p className="mt-2.5 text-[12.5px] text-muted">
              {result.rows.length} {result.rows.length === 1 ? 'person' : 'people'}. The question goes to a model; the filtering and counting run in code.
            </p>
          </section>
        ) : (
          <EmptyState title="Ask anything about the pipeline" icon={Sparkles}>
            Routes, language levels, start dates, deadlines, conflicts, readiness. The copilot builds the view it needs for your question.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
