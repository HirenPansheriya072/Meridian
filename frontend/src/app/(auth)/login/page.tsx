'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'form' | 'demo' | null>(null);

  async function enter(fn: () => Promise<unknown>, mode: 'form' | 'demo') {
    setError('');
    setLoading(mode);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: ['session'] });
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setLoading(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl">Sign in</h1>
      <p className="mt-1 text-[13px] text-ink-muted">Back to your calendar.</p>

      <Button
        variant="secondary"
        className="mt-6 w-full"
        loading={loading === 'demo'}
        onClick={() => enter(() => api.post('/auth/demo'), 'demo')}
      >
        Try the demo
      </Button>
      <p className="mt-2 text-center text-[12px] text-ink-faint">
        A studio with hosts in London, New York, and Kolkata.
      </p>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-rule" />
        <span className="spec">or</span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <form
        className="space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          enter(() => api.post('/auth/login', { email, password }), 'form');
        }}
      >
        <Field label="Email">
          <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" error={error}>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" variant="primary" className="w-full" loading={loading === 'form'}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        New here?{' '}
        <Link href="/register" className="font-medium text-dusk hover:underline">
          Create a workspace
        </Link>
      </p>
    </div>
  );
}
