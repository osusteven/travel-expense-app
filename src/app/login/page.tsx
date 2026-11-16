import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl shadow-accent/20">
        <div className="hero px-6 py-8 text-white">
          <span aria-hidden className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/20 text-2xl">✈︎</span>
          <h1 className="text-2xl font-extrabold tracking-tight">Travel Ledger</h1>
          <p className="text-sm text-white/80">Shared trip expenses, sorted.</p>
        </div>
        <div className="p-6">
          <LoginForm next={typeof next === "string" ? next : "/"} />
        </div>
      </div>
    </main>
  );
}
