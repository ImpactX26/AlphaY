import { ROUTE_LABEL, type GapPlanBlock, type MatrixBlock, type OpportunitiesBlock, type RouteBlock, type ShortlistBlock } from '@educaro/shared';
import clsx from 'clsx';
import { ArrowUpRight, BadgeCheck, Clock, Link2, MapPin, Plus, Wallet } from 'lucide-react';
import { useState } from 'react';
import { hostOf } from '../../lib/format';
import { EXAM_STATUS, ITEM_STATUS, MATRIX_STATUS } from '../../lib/tags';
import { Button } from '../../ui/Button';
import { Countdown, ExternalLink } from '../../ui/misc';
import { Spinner } from '../../ui/Spinner';
import { Chip, FieldTag, RoleLabel, Tag } from '../../ui/Tag';
import { BlockFrame, Kicker } from '../BlockFrame';
import { useScreenActions } from '../context';

export function RouteCard({ block }: { block: RouteBlock }) {
  const { setRoute, readOnly } = useScreenActions();
  const ck = block.chancenkarte;
  return (
    <BlockFrame
      kicker={<Kicker>{block.title ?? 'Your route'}</Kicker>}
      body={block.body}
      headerExtra={<Chip tone="applicant" className="flex-none">{ROUTE_LABEL[block.primary]}</Chip>}
      footer={
        block.alternatives.length ? (
          <span className="flex flex-wrap items-center gap-2">
            Also possible:
            {block.alternatives.map((r) => (
              <button key={r} type="button" className="chip" disabled={readOnly} onClick={() => setRoute(r)} title={`Switch to ${ROUTE_LABEL[r]}`}>
                {ROUTE_LABEL[r]}
              </button>
            ))}
          </span>
        ) : null
      }
    >
      <ul className="space-y-1.5">
        {block.reasons.map((reason) => (
          <li key={reason} className="flex gap-2 text-[14px]">
            <BadgeCheck size={16} className="mt-0.5 flex-none text-ok" aria-hidden />
            {reason}
          </li>
        ))}
      </ul>
      {ck ? (
        <div className="mt-3.5 rounded-lg border border-line bg-surface-2/50 px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-semibold">Opportunity Card (Chancenkarte) points</p>
            <p className="num text-[13px]">
              <span className={clsx('display text-[20px] font-extrabold', ck.total >= ck.needed ? 'text-ok' : 'text-warn')}>{ck.total}</span>
              <span className="text-muted"> of {ck.needed} needed</span>
            </p>
          </div>
          <ul className="mt-2 space-y-1 text-[13px]">
            {ck.lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-3">
                <span className={clsx(line.points === 0 && 'text-muted')}>{line.label}</span>
                <span className="num flex-none font-semibold">{line.points > 0 ? `+${line.points}` : '—'}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12.5px] text-muted">Counted in code from the official points grid, never guessed.</p>
        </div>
      ) : null}
    </BlockFrame>
  );
}

export function OpportunitiesCard({ block }: { block: OpportunitiesBlock }) {
  const { shortlist, shortlistingId, readOnly } = useScreenActions();
  const [url, setUrl] = useState('');
  const [pasting, setPasting] = useState(false);
  const pasted = shortlistingId === 'pasted-url';
  return (
    <BlockFrame kicker={<Kicker>{block.title ?? 'Worth a look'}</Kicker>} body={block.body}>
      <ul className="space-y-2.5">
        {block.items.map((item) => (
          <li key={item.id} className="rounded-lg border border-line px-3.5 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold leading-snug">{item.title}</p>
                <p className="mt-0.5 text-[13px] text-muted">{item.subtitle}</p>
              </div>
              {item.shortlisted ? (
                <Tag s={ITEM_STATUS.ready} className="flex-none">
                  Shortlisted
                </Tag>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  className="flex-none"
                  disabled={readOnly}
                  loading={shortlistingId === item.id}
                  onClick={() => shortlist(item.kind === 'opening' ? { openingId: item.id } : { programmeId: item.id })}
                >
                  Shortlist
                </Button>
              )}
            </div>
            <p className="mt-2 text-[13.5px]">{item.why}</p>
            {item.url ? (
              <p className="mt-1.5 text-[12.5px]">
                <ExternalLink href={item.url} className="text-muted">
                  {hostOf(item.url)}
                </ExternalLink>
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {pasting ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!url.trim()) return;
            shortlist({ url: url.trim() });
            setUrl('');
            setPasting(false);
          }}
        >
          <input
            className="input"
            autoFocus
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… a programme or job page"
            aria-label="Link to a programme or opening"
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary" loading={pasted} disabled={!url.trim()}>
              Check it
            </Button>
            <Button variant="ghost" onClick={() => setPasting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <button type="button" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-agent" disabled={readOnly} onClick={() => setPasting(true)}>
          <Link2 size={15} aria-hidden />
          Found something yourself? Paste any link
        </button>
      )}
    </BlockFrame>
  );
}

export function ShortlistCard({ block }: { block: ShortlistBlock }) {
  return (
    <BlockFrame kicker={<Kicker>{block.title ?? 'Your shortlist'}</Kicker>} body={block.body}>
      <ul className="divide-y divide-line">
        {block.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold">{item.title}</span>
              <span className="block truncate text-[12.5px] text-muted">{item.subtitle}</span>
            </span>
            {item.status === 'checking' ? (
              <span className="flex flex-none items-center gap-1.5 text-[12.5px] font-medium text-agent">
                <Spinner size={13} /> Reading their page
              </span>
            ) : (
              <Tag s={ITEM_STATUS[item.status]} className="flex-none">
                {item.gapCount ? `${item.gapCount} ${item.gapCount === 1 ? 'gap' : 'gaps'}` : 'Ready'}
              </Tag>
            )}
          </li>
        ))}
      </ul>
    </BlockFrame>
  );
}

/** The requirement matrix: what the target needs, what they have, with the source of every row. */
export function MatrixCard({ block }: { block: MatrixBlock }) {
  return (
    <BlockFrame
      kicker={<Kicker>Requirement matrix</Kicker>}
      title={block.title}
      body={block.body}
      footer={<span>Each row comes from the target’s own page and your documents. Grades, levels and days are compared in code.</span>}
    >
      {block.deadline ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/50 px-3.5 py-2.5">
          <span className="text-[13px] font-semibold">{block.deadline.label}</span>
          <Countdown date={block.deadline.date} days={block.deadline.daysLeft} />
        </div>
      ) : null}

      <ul className="space-y-2.5 md:hidden">
        {block.rows.map((row) => (
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
            {block.rows.map((row) => (
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

      {block.exams.length ? (
        <div className="mt-3.5">
          <Kicker className="mb-2">Exams this one needs</Kicker>
          <div className="flex flex-wrap gap-2">
            {block.exams.map((exam) => (
              <Tag key={exam.name} s={EXAM_STATUS[exam.status]}>
                {exam.name}: {EXAM_STATUS[exam.status].label}
              </Tag>
            ))}
          </div>
        </div>
      ) : null}
    </BlockFrame>
  );
}

/** Gap plans: never a rejection. What, where, how long, what it costs, and the Educaro service. */
export function GapPlanCard({ block }: { block: GapPlanBlock }) {
  return (
    <BlockFrame kicker={<Kicker>{block.title ?? 'Your plan for the gaps'}</Kicker>} body={block.body}>
      <ol className="space-y-3">
        {block.gaps.map((gap, i) => (
          <li key={gap.id} className="rounded-lg border border-line px-3.5 py-3">
            <div className="flex items-baseline gap-2.5">
              <span className="display num flex-none text-[13px] font-bold text-muted">{i + 1}</span>
              <p className="display text-[15.5px] font-bold leading-snug">{gap.title}</p>
            </div>
            <p className="mt-1.5 text-[14px] leading-relaxed">{gap.what}</p>
            <dl className="mt-2.5 grid gap-x-4 gap-y-1.5 text-[13px] sm:grid-cols-3">
              <div className="flex gap-2">
                <dt className="flex-none text-muted">
                  <MapPin size={14} aria-hidden className="mt-0.5" />
                  <span className="sr-only">Where</span>
                </dt>
                <dd>{gap.where}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="flex-none text-muted">
                  <Clock size={14} aria-hidden className="mt-0.5" />
                  <span className="sr-only">How long</span>
                </dt>
                <dd>{gap.howLong}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="flex-none text-muted">
                  <Wallet size={14} aria-hidden className="mt-0.5" />
                  <span className="sr-only">Cost</span>
                </dt>
                <dd>{gap.cost}</dd>
              </div>
            </dl>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {gap.service ? (
                <a href={gap.service.url} target="_blank" rel="noopener noreferrer" className="qr no-underline">
                  <RoleLabel role="staff" className="!text-[10px]">
                    Educaro
                  </RoleLabel>
                  {gap.service.name}
                  <ArrowUpRight size={14} aria-hidden />
                </a>
              ) : null}
              {gap.links.map((link) => (
                <ExternalLink key={link.url} href={link.url} className="text-[13px] text-muted">
                  {link.label}
                </ExternalLink>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {!block.gaps.length ? (
        <p className="flex items-center gap-2 text-[14px] text-muted">
          <Plus size={15} aria-hidden /> No gaps left. Everything on your plan is done.
        </p>
      ) : null}
    </BlockFrame>
  );
}
