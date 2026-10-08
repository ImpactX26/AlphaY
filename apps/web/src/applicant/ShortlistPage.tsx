import { Link2, ListChecks, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { api, errorText } from '../api/client';
import { useQueryClient } from '@tanstack/react-query';
import { qk, useAddShortlist, useScreen, useShortlist } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { hostOf } from '../lib/format';
import { EXAM_STATUS, ITEM_STATUS, MATRIX_STATUS } from '../lib/tags';
import { OpportunitiesCard } from '../screen/blocks/plan';
import { ScreenActionsProvider, type ScreenActions } from '../screen/context';
import { Button } from '../ui/Button';
import { Countdown, EmptyState, ExternalLink, PageHeader, Skeleton } from '../ui/misc';
import { Spinner } from '../ui/Spinner';
import { FieldTag, Tag } from '../ui/Tag';
import { toast } from '../ui/Toast';

export default function ShortlistPage() {
  const applicantId = useApplicantId();
  const qc = useQueryClient();
  const { data: shortlist, isLoading } = useShortlist(applicantId);
  const { data: screen } = useScreen(applicantId);
  const add = useAddShortlist(applicantId);
  const [url, setUrl] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const opportunities = screen?.blocks.filter((b): b is Extract<typeof b, { type: 'opportunities' }> => b.type === 'opportunities') ?? [];

  const actions = useMemo<ScreenActions>(
    () => ({
      applicantId,
      readOnly: false,
      answeringQuestionId: null,
      answerQuestion: () => {},
      sendChat: () => {},
      shortlistingId: add.isPending ? (add.variables.programmeId ?? add.variables.openingId ?? 'pasted-url') : null,
      shortlist: (input) => add.mutate(input, { onSuccess: () => toast('Shortlisted. The agent is reading their page.'), onError: (err) => toast(errorText(err), 'error') }),
      openApproval: () => {},
      goUpload: () => {},
      setRoute: () => {},
    }),
    [applicantId, add],
  );

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await api.removeShortlist(id);
      void qc.invalidateQueries({ queryKey: qk.shortlist(applicantId) });
      toast('Removed from your shortlist');
    } catch (err) {
      toast(errorText(err), 'error');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <ScreenActionsProvider value={actions}>
      <div className="max-w-4xl">
        <PageHeader title="Shortlist and requirements">
          Shortlist a programme or an employer and the agent reads their own page, then lists every exam, paper and deadline it asks for.
        </PageHeader>

        <form
          className="mb-6 flex flex-col gap-2 rounded-lg border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim()) return;
            add.mutate(
              { url: url.trim() },
              {
                onSuccess: () => {
                  setUrl('');
                  toast('Opening that page now.');
                },
                onError: (err) => toast(errorText(err), 'error'),
              },
            );
          }}
        >
          <label className="min-w-0 flex-1">
            <span className="label flex items-center gap-1.5">
              <Link2 size={14} aria-hidden />
              Found a programme or job yourself? Paste the link
            </span>
            <input className="input" type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.rwth-aachen.de/…" />
          </label>
          <Button type="submit" variant="primary" loading={add.isPending && !add.variables?.programmeId} disabled={!url.trim()}>
            Check its requirements
          </Button>
        </form>

        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : shortlist?.length ? (
          <ul className="space-y-5">
            {shortlist.map((item) => (
              <li key={item.id} className="card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <h2 className="display text-[17px] font-bold leading-snug">{item.title}</h2>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {item.subtitle}
                      {item.url ? (
                        <>
                          {' · '}
                          <ExternalLink href={item.url}>{hostOf(item.url)}</ExternalLink>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    {item.status === 'checking' ? (
                      <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-agent">
                        <Spinner size={13} /> Reading their page
                      </span>
                    ) : (
                      <Tag s={ITEM_STATUS[item.status]}>{item.gapCount ? `${item.gapCount} ${item.gapCount === 1 ? 'gap' : 'gaps'}` : 'Ready'}</Tag>
                    )}
                    <Button size="sm" variant="ghost" icon={Trash2} loading={removing === item.id} onClick={() => remove(item.id)} aria-label={`Remove ${item.title}`} />
                  </div>
                </div>

                {item.matrix ? (
                  <div className="px-4 py-4 sm:px-5">
                    {item.matrix.deadline ? (
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/50 px-3.5 py-2.5">
                        <span className="text-[13px] font-semibold">{item.matrix.deadline.label}</span>
                        <Countdown date={item.matrix.deadline.date} days={item.matrix.deadline.daysLeft} />
                      </div>
                    ) : null}

                    <ul className="space-y-2.5 md:hidden">
                      {item.matrix.rows.map((row) => (
                        <li key={row.requirement} className="rounded-lg border border-line px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-[14px] font-semibold">{row.requirement}</p>
                            <Tag s={MATRIX_STATUS[row.status]} className="flex-none" />
                          </div>
                          <p className="mt-1.5 text-[13px] text-muted">Needs: {row.needs}</p>
                          <p className="text-[13px]">You have: {row.has}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2">
                            <FieldTag tag={row.tag} />
                            {row.sourceUrl ? (
                              <ExternalLink href={row.sourceUrl} className="text-[12px] text-muted">
                                {hostOf(row.sourceUrl)}
                              </ExternalLink>
                            ) : null}
                          </p>
                        </li>
                      ))}
                    </ul>
                    <div tabIndex={0} className="tbl-wrap hidden md:block">
                      <table className="tbl">
                        <thead>
                          <tr>
                            <th scope="col">Requirement</th>
                            <th scope="col">They need</th>
                            <th scope="col">You have</th>
                            <th scope="col">Status</th>
                            <th scope="col">Source</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.matrix.rows.map((row) => (
                            <tr key={row.requirement}>
                              <th scope="row" className="font-semibold">
                                {row.requirement}
                              </th>
                              <td className="text-muted">{row.needs}</td>
                              <td>{row.has}</td>
                              <td>
                                <Tag s={MATRIX_STATUS[row.status]} />
                              </td>
                              <td className="whitespace-nowrap">
                                <FieldTag tag={row.tag} />
                                {row.sourceUrl ? (
                                  <ExternalLink href={row.sourceUrl} className="ml-1.5 text-[12px] text-muted">
                                    {hostOf(row.sourceUrl)}
                                  </ExternalLink>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {item.matrix.exams.length ? (
                      <div className="mt-3.5 flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted">Exams</span>
                        {item.matrix.exams.map((exam) => (
                          <Tag key={exam.name} s={EXAM_STATUS[exam.status]}>
                            {exam.name}: {EXAM_STATUS[exam.status].label}
                          </Tag>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 px-4 py-5 text-[13.5px] text-muted sm:px-5">
                    <Spinner size={15} className="text-agent" />
                    The agent is opening their page and pulling out the admission rules, exams and deadlines.
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing shortlisted yet" icon={ListChecks}>
            Shortlist one of the suggestions below, or paste any link above. The agent then reads their page and compares it with your documents.
          </EmptyState>
        )}

        {opportunities.length ? (
          <div className="mt-7 space-y-4">
            {opportunities.map((block) => (
              <OpportunitiesCard key={block.id} block={block} bare />
            ))}
          </div>
        ) : null}
      </div>
    </ScreenActionsProvider>
  );
}
