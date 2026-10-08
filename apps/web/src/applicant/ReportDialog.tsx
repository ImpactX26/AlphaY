import type { ReportCategory, ReportSeverity } from '@educaro/shared';
import clsx from 'clsx';
import { Lock, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import { useSendReport } from '../api/queries';
import { useApplicantId } from '../auth/auth';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { toast } from '../ui/Toast';

/**
 * Telling us, privately, that something is wrong at work.
 *
 * The API for this existed and nothing called it: the Help block rendered the invitation as a
 * paragraph, so the one thing on the page that was meant to be an action was a sentence. Somebody
 * on a bad shift does not compose an email to an agency.
 *
 * Three choices that are the whole design:
 *
 * - **The button is always visible, not behind a menu.** This is opened on the worst day somebody
 *   has had since arriving, and it has to be findable without reading.
 * - **The confidentiality promise is next to the send button, not in a footer.** The fear that
 *   stops a report is that the employer will hear about it, and that fear has to be answered at
 *   the moment of pressing, not at the top of a page they scrolled past.
 * - **Nothing is optimistic.** The row only appears once the server has it. Somebody who has just
 *   reported being shouted at must not watch their message vanish on a failed request.
 */

const CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: 'pay', label: 'Pay' },
  { value: 'hours', label: 'Hours or shifts' },
  { value: 'housing', label: 'Accommodation' },
  { value: 'documents', label: 'My documents or passport' },
  { value: 'respect', label: 'How I am treated' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Something else' },
];

const SEVERITIES: { value: ReportSeverity; label: string; hint: string }[] = [
  { value: 'note', label: 'Just so you know', hint: 'Nothing urgent. Worth recording.' },
  { value: 'concern', label: 'I am worried', hint: 'It keeps happening and I want someone to look.' },
  { value: 'serious', label: 'This is serious', hint: 'A consultant will call you today.' },
];

export function ReportButton({ hint }: { hint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mt-4 rounded-md border border-line bg-surface-2 px-3 py-3">
        <p className="text-[13px]">{hint ?? 'Tell us privately if an employer treats you badly. It stays between you and Educaro.'}</p>
        <Button variant="primary" icon={ShieldAlert} className="mt-2.5" onClick={() => setOpen(true)}>
          Something is wrong at work
        </Button>
      </div>
      {open ? <ReportDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ReportDialog({ onClose }: { onClose: () => void }) {
  const applicantId = useApplicantId();
  const send = useSendReport(applicantId);
  const [employer, setEmployer] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState<ReportCategory>('respect');
  const [severity, setSeverity] = useState<ReportSeverity>('concern');

  const ready = employer.trim().length > 1 && text.trim().length > 10;

  return (
    <Dialog open title="Tell us, privately" onClose={onClose}>
      <p className="flex items-start gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px]">
        <Lock size={14} className="mt-[2px] flex-none text-muted" aria-hidden />
        <span>
          Your employer will never see this and will never know it came from you. A consultant reads it today. It also changes how we rate
          that employer for everyone who comes after you — but only ever as part of a total, never as your words.
        </span>
      </p>

      <label className="mt-4 block">
        <span className="label">Who is it about?</span>
        <input
          value={employer}
          onChange={(e) => setEmployer(e.target.value)}
          placeholder="The hospital, clinic or company"
          className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-agent"
        />
      </label>

      <fieldset className="mt-3">
        <legend className="label">What is it about?</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className={clsx('rounded-full border px-3 py-1.5 text-[13px] transition', category === c.value ? 'border-agent bg-agent font-medium text-white' : 'border-line hover:border-agent/50')}
            >
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block">
        <span className="label">What happened?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="In your own words. Dates and numbers help a consultant act on it, but say it however is easiest."
          className="mt-1 w-full resize-y rounded-md border border-line bg-surface px-3 py-2 text-[14px] outline-none focus:border-agent"
        />
      </label>

      <fieldset className="mt-3">
        <legend className="label">How urgent is it?</legend>
        <div className="mt-1.5 space-y-2">
          {SEVERITIES.map((s) => (
            <label key={s.value} className={clsx('flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-2.5', severity === s.value ? 'border-ink' : 'border-line')}>
              <input type="radio" name="severity" className="mt-1" checked={severity === s.value} onChange={() => setSeverity(s.value)} />
              <span>
                <span className="block text-[14px] font-semibold">{s.label}</span>
                <span className="block text-[12.5px] text-muted">{s.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          loading={send.isPending}
          disabled={!ready}
          onClick={() =>
            send.mutate(
              { employer: employer.trim(), text: text.trim(), category, severity },
              {
                onSuccess: () => {
                  toast('Sent. It stays between you and Educaro, and a consultant reads it today.');
                  onClose();
                },
                onError: () => toast('That did not send. Try again, or call the number on the Safety page.', 'error'),
              },
            )
          }
        >
          Send privately
        </Button>
        <Button onClick={onClose}>Cancel</Button>
        <span className="text-[12px] text-muted">Only Educaro sees this.</span>
      </div>
    </Dialog>
  );
}
