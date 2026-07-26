'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError, type FieldError } from '@/lib/api';
import { guessTimezone, zoneCity } from '@/lib/tz';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { TimezonePicker } from '@/components/timezone-picker';

export default function RegisterPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState({ orgName: '', name: '', email: '', password: '', timezone: 'UTC' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Detect their zone up front -- it is the one field people get wrong, and the
  // one everything else depends on.
  useEffect(() => {
    setForm((f) => ({ ...f, timezone: guessTimezone() }));
  }, []);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      await qc.invalidateQueries({ queryKey: ['session'] });
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const mapped: Record<string, string> = {};
        err.details.forEach((d: FieldError) => (mapped[d.field] = d.message));
        setErrors(mapped);
      } else {
        setErrors({ email: err instanceof Error ? err.message : 'Something went wrong' });
      }
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl">Create a workspace</h1>
      <p className="mt-1 text-[13px] text-ink-muted">
        You&rsquo;ll get a 9-to-5 schedule and a bookable link straight away.
      </p>

      <form className="mt-6 space-y-3.5" onSubmit={submit}>
        <Field label="Business name" error={errors.orgName}>
          <Input value={form.orgName} onChange={set('orgName')} placeholder="Longitude Studio" required />
        </Field>
        <Field label="Your name" error={errors.name}>
          <Input value={form.name} onChange={set('name')} placeholder="Ines Whitlock" required />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters.">
          <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required />
        </Field>

        <div className="space-y-1.5">
          <label className="block text-[13px] font-medium">Your timezone</label>
          <TimezonePicker
            value={form.timezone}
            onChange={(timezone) => setForm((f) => ({ ...f, timezone }))}
            className="w-full justify-start"
          />
          <p className="text-[12px] text-ink-faint">
            Your working hours are written in {zoneCity(form.timezone)} time.
          </p>
        </div>

        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Create workspace
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        Already have one?{' '}
        <Link href="/login" className="font-medium text-dusk hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
