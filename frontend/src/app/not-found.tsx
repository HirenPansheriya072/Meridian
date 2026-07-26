import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="spec">404</p>
      <h1 className="font-display text-3xl">This page does not exist</h1>
      <Link href="/dashboard" className="mt-2 text-sm font-medium text-dusk hover:underline">
        Back to the dashboard
      </Link>
    </main>
  );
}
