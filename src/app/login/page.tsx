import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
      <h1 className="mb-1 text-2xl font-semibold">Travel Ledger</h1>
      <p className="mb-6 text-sm text-muted">Enter the shared password to continue.</p>
      <LoginForm next={typeof next === "string" ? next : "/"} />
    </main>
  );
}
