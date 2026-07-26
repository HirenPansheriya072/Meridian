'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { useSaveEventType, useTeam } from '@/lib/queries';
import type { EventType, Question } from '@/lib/types';
import { ASSIGNMENT_LABEL, cn, durationLabel, noticeLabel } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea, CustomSelect } from '@/components/ui/input';
import { Avatar } from '@/components/ui/misc';

const DURATIONS = [15, 20, 30, 45, 60, 90, 120];
const NOTICES = [0, 30, 60, 120, 240, 720, 1440, 2880];

export function EventTypeForm({ eventType, id }: { eventType?: EventType; id?: string }) {
  const router = useRouter();
  const { data: team } = useTeam();
  const save = useSaveEventType(id);

  const [form, setForm] = useState({
    title: '',
    description: '',
    redirectUrl: '',
    durationMinutes: 30,
    slotIncrementMinutes: 15,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minimumNoticeMinutes: 60,
    maximumAdvanceDays: 60,
    maxBookingsPerDay: 0,
    assignment: 'single' as EventType['assignment'],
    locationType: 'video' as EventType['location']['type'],
    locationDetail: '',
    active: true,
    requiresConfirmation: false,
  });
  const [hostIds, setHostIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (eventType) {
      setForm({
        title: eventType.title,
        description: eventType.description || '',
        redirectUrl: eventType.redirectUrl || '',
        durationMinutes: eventType.durationMinutes,
        slotIncrementMinutes: eventType.slotIncrementMinutes,
        bufferBeforeMinutes: eventType.bufferBeforeMinutes,
        bufferAfterMinutes: eventType.bufferAfterMinutes,
        minimumNoticeMinutes: eventType.minimumNoticeMinutes,
        maximumAdvanceDays: eventType.maximumAdvanceDays,
        maxBookingsPerDay: eventType.maxBookingsPerDay,
        assignment: eventType.assignment,
        locationType: eventType.location.type,
        locationDetail: eventType.location.detail || '',
        active: eventType.active,
        requiresConfirmation: eventType.requiresConfirmation,
      });
      setHostIds(eventType.hostIds);
      setQuestions(eventType.questions);
    }
  }, [eventType]);

  // A new event type defaults to whoever is looking at it.
  useEffect(() => {
    if (!eventType && team?.items.length && hostIds.length === 0) {
      setHostIds([team.items[0].id]);
    }
  }, [team, eventType, hostIds.length]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const setNumber = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: Number(e.target.value) }));

  function submit() {
    const problems: Record<string, string> = {};
    if (form.title.trim().length < 2) problems.title = 'Give it a name';
    if (hostIds.length === 0) problems.hosts = 'Pick at least one host';
    if (form.assignment !== 'single' && hostIds.length < 2) {
      problems.hosts = 'Group scheduling needs two or more hosts';
    }
    if (Object.keys(problems).length) return setErrors(problems);
    setErrors({});

    save.mutate(
      {
        title: form.title.trim(),
        description: form.description,
        redirectUrl: form.redirectUrl.trim() || undefined,
        durationMinutes: form.durationMinutes,
        slotIncrementMinutes: form.slotIncrementMinutes,
        bufferBeforeMinutes: form.bufferBeforeMinutes,
        bufferAfterMinutes: form.bufferAfterMinutes,
        minimumNoticeMinutes: form.minimumNoticeMinutes,
        maximumAdvanceDays: form.maximumAdvanceDays,
        maxBookingsPerDay: form.maxBookingsPerDay,
        assignment: form.assignment,
        hostIds,
        location: { type: form.locationType, detail: form.locationDetail },
        questions: questions.map((q) => ({
          key: q.key || q.label.toLowerCase().replace(/\W+/g, '_').slice(0, 24),
          label: q.label,
          type: q.type,
          options: q.options,
          required: q.required,
        })),
        active: form.active,
        requiresConfirmation: form.requiresConfirmation,
      },
      { onSuccess: () => router.push('/event-types') }
    );
  }

  return (
    <div className="grid max-w-4xl gap-5 lg:grid-cols-[1fr_260px]">
      <div className="space-y-5">
        <section className="card p-5">
          <p className="spec">Basics</p>
          <div className="mt-4 space-y-4">
            <Field label="Title" error={errors.title}>
              <Input value={form.title} onChange={set('title')} placeholder="Intro call" />
            </Field>
            <Field label="Description" hint="Shown on the booking page.">
              <Textarea rows={3} value={form.description} onChange={set('description')} />
            </Field>
            <Field label="Redirect URL" hint="Optional web page redirect URL. Booker is redirected here upon booking.">
              <Input value={form.redirectUrl} onChange={set('redirectUrl')} placeholder="https://mycompany.com/thank-you" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duration">
                <CustomSelect
                  value={form.durationMinutes}
                  onChange={(val) => setForm((f) => ({ ...f, durationMinutes: Number(val) }))}
                  options={DURATIONS.map((d) => ({ value: d, label: durationLabel(d) }))}
                />
              </Field>
              <Field label="Offer slots every" hint="The grid times sit on.">
                <CustomSelect
                  value={form.slotIncrementMinutes}
                  onChange={(val) => setForm((f) => ({ ...f, slotIncrementMinutes: Number(val) }))}
                  options={[5, 10, 15, 20, 30, 60].map((d) => ({ value: d, label: `${d} min` }))}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Location">
                <CustomSelect
                  value={form.locationType}
                  onChange={(val) => setForm((f) => ({ ...f, locationType: val as EventType['location']['type'] }))}
                  options={[
                    { value: 'video', label: 'Video call' },
                    { value: 'phone', label: 'Phone call' },
                    { value: 'inPerson', label: 'In person' },
                    { value: 'custom', label: 'Custom' },
                  ]}
                />
              </Field>
              <Field label="Detail" hint="Address, link, or a note.">
                <Input value={form.locationDetail} onChange={set('locationDetail')} />
              </Field>
            </div>
          </div>
        </section>

        <section className="card p-5">
          <p className="spec">Hosts</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {ASSIGNMENT_LABEL[form.assignment].note}
          </p>

          <div className="mt-4 space-y-4">
            <Field label="How hosts are picked">
              <CustomSelect
                value={form.assignment}
                onChange={(val) => setForm((f) => ({ ...f, assignment: val as EventType['assignment'] }))}
                options={[
                  { value: 'single', label: 'One host' },
                  { value: 'collective', label: 'Everyone must attend' },
                  { value: 'roundRobin', label: 'Round robin' },
                ]}
              />
            </Field>

            <div>
              <p className="mb-2 text-[13px] font-medium">Who</p>
              <ul className="space-y-1.5">
                {team?.items.map((user) => {
                  const on = hostIds.includes(user.id);
                  return (
                    <li key={user.id}>
                      <button
                        onClick={() =>
                          setHostIds((prev) =>
                            on ? prev.filter((h) => h !== user.id) : [...prev, user.id]
                          )
                        }
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded border px-3 py-2 text-left transition-colors',
                          on ? 'border-dusk bg-dusk-soft' : 'border-rule-strong bg-surface hover:border-ink-faint'
                        )}
                      >
                        <Avatar name={user.name} color={user.avatarColor} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px]">{user.name}</span>
                          <span className="block truncate font-mono text-[10px] text-ink-faint">
                            {user.timezone}
                          </span>
                        </span>
                        <span
                          className={cn(
                            'h-3.5 w-3.5 shrink-0 rounded-sm border',
                            on ? 'border-dusk bg-dusk' : 'border-rule-strong'
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {errors.hosts ? <p className="mt-1.5 text-[12px] text-bad">{errors.hosts}</p> : null}
              {form.assignment === 'collective' && hostIds.length > 1 ? (
                <p className="mt-2 rounded border border-dawn/30 bg-dawn-soft px-2.5 py-2 text-[11px] leading-snug text-dawn-dark">
                  Only times when all {hostIds.length} are free will be offered. Across timezones that
                  window can be narrow — worth checking the preview.
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="card p-5">
          <p className="spec">Limits</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Buffer before" hint="Padding ahead of each booking.">
              <CustomSelect
                value={form.bufferBeforeMinutes}
                onChange={(val) => setForm((f) => ({ ...f, bufferBeforeMinutes: Number(val) }))}
                options={[0, 5, 10, 15, 30, 60].map((d) => ({ value: d, label: d === 0 ? 'None' : `${d} min` }))}
              />
            </Field>
            <Field label="Buffer after">
              <CustomSelect
                value={form.bufferAfterMinutes}
                onChange={(val) => setForm((f) => ({ ...f, bufferAfterMinutes: Number(val) }))}
                options={[0, 5, 10, 15, 30, 60].map((d) => ({ value: d, label: d === 0 ? 'None' : `${d} min` }))}
              />
            </Field>
            <Field label="Minimum notice" hint="How close to the start someone can still book.">
              <CustomSelect
                value={form.minimumNoticeMinutes}
                onChange={(val) => setForm((f) => ({ ...f, minimumNoticeMinutes: Number(val) }))}
                options={NOTICES.map((d) => ({ value: d, label: noticeLabel(d) }))}
              />
            </Field>
            <Field label="Book up to" hint="How far ahead the calendar opens.">
              <CustomSelect
                value={form.maximumAdvanceDays}
                onChange={(val) => setForm((f) => ({ ...f, maximumAdvanceDays: Number(val) }))}
                options={[7, 14, 30, 45, 60, 90, 180, 365].map((d) => ({ value: d, label: `${d} days` }))}
              />
            </Field>
            <Field label="Max per day" hint="0 means no limit.">
              <Input
                type="number"
                min={0}
                max={50}
                value={form.maxBookingsPerDay}
                onChange={setNumber('maxBookingsPerDay')}
                className="tnum font-mono"
              />
            </Field>
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="spec">Questions</p>
              <p className="mt-1 text-[13px] text-ink-muted">Asked when someone books.</p>
            </div>
            <Button
              size="sm"
              onClick={() =>
                setQuestions((prev) => [
                  ...prev,
                  { key: `q${prev.length + 1}`, label: '', type: 'text', options: [], required: false },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          {questions.length === 0 ? (
            <p className="mt-4 text-[13px] text-ink-faint">
              Name and email are always asked. Add anything else you need up front.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {questions.map((q, i) => (
                <li key={i} className="rounded border border-rule bg-chalk/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={q.label}
                      onChange={(e) =>
                        setQuestions((prev) => prev.map((x, xi) => (xi === i ? { ...x, label: e.target.value } : x)))
                      }
                      placeholder="Question"
                      className="h-9 min-w-[180px] flex-1 text-[13px]"
                    />
                    <CustomSelect
                      value={q.type}
                      onChange={(val) =>
                        setQuestions((prev) =>
                          prev.map((x, xi) => (xi === i ? { ...x, type: val as Question['type'] } : x))
                        )
                      }
                      options={[
                        { value: 'text', label: 'Short text' },
                        { value: 'textarea', label: 'Long text' },
                        { value: 'select', label: 'Choice' },
                        { value: 'phone', label: 'Phone' },
                      ]}
                      className="h-9 w-[120px] [&>button]:h-9 [&>button]:text-[13px]"
                    />
                    <label className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                      <input
                        type="checkbox"
                        checked={q.required}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((x, xi) => (xi === i ? { ...x, required: e.target.checked } : x))
                          )
                        }
                        className="h-3.5 w-3.5 accent-dusk"
                      />
                      Required
                    </label>
                    <button
                      onClick={() => setQuestions((prev) => prev.filter((_, xi) => xi !== i))}
                      className="rounded p-1.5 text-ink-faint transition-colors hover:bg-bad/10 hover:text-bad"
                      aria-label="Remove question"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {q.type === 'select' ? (
                    <Input
                      value={q.options.join(', ')}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((x, xi) =>
                            xi === i
                              ? { ...x, options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) }
                              : x
                          )
                        )
                      }
                      placeholder="Options, comma separated"
                      className="mt-2 h-9 text-[13px]"
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-5 lg:self-start">
        <div className="card p-4">
          <p className="spec">Summary</p>
          <dl className="mt-3 space-y-2 text-[12px]">
            {[
              ['Length', durationLabel(form.durationMinutes)],
              ['Slots every', `${form.slotIncrementMinutes} min`],
              ['Hosts', `${hostIds.length} · ${ASSIGNMENT_LABEL[form.assignment].label}`],
              ['Notice', noticeLabel(form.minimumNoticeMinutes)],
              ['Open for', `${form.maximumAdvanceDays} days`],
              ...(form.maxBookingsPerDay > 0 ? [['Daily cap', `${form.maxBookingsPerDay}`]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-2">
                <dt className="text-ink-faint">{label}</dt>
                <dd className="text-right text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <label className="mt-4 flex items-center gap-2 border-t border-rule pt-3 text-[13px]">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              className="h-3.5 w-3.5 accent-dusk"
            />
            Bookable
          </label>

          <div className="mt-4 flex gap-2">
            <Button variant="ghost" className="flex-1" onClick={() => router.push('/event-types')}>
              Cancel
            </Button>
            <Button variant="primary" className="flex-1" loading={save.isPending} onClick={submit}>
              {id && id !== 'new' ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
