import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, GraduationCap, ShieldCheck, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PoweredBy } from "@/components/PoweredBy";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Infinite EduSuite — Cloud Platform for Modern Colleges" },
      {
        name: "description",
        content:
          "Unify admissions, finance, academics and the student portal across every campus. Enterprise-grade. Branch-isolated. Built for scale.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { auth } = Route.useRouteContext();
  const ctaTarget = auth.isAuthenticated ? "/dashboard" : "/login";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: "var(--gradient-primary)" }}>
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-base font-semibold tracking-tight">Infinite EduSuite</span>
          </Link>
          <Button asChild size="sm">
            <Link to={ctaTarget}>{auth.isAuthenticated ? "Open dashboard" : "Sign in"}</Link>
          </Button>
        </div>
      </header>

      <section className="relative overflow-hidden bg-[#081a3d]">
        <div className="absolute inset-0 -z-20 bg-[#081a3d]" />
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.15),transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.12),rgba(15,23,42,0.32))]"
          aria-hidden="true"
        />
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:py-40">
          <div className="max-w-3xl text-white">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/80 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              Multi-branch • Cloud-native • Kenya-ready
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-tight text-white drop-shadow-sm sm:text-6xl">
              The operating system for modern colleges.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
              Run admissions, fees, exams and the student portal across every branch from one
              secure platform. Built for institutions that take governance, compliance and the
              student experience seriously.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={ctaTarget}>
                  {auth.isAuthenticated ? "Go to dashboard" : "Sign in to portal"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Building2, title: "Multi-branch core", body: "Centralised data with strict branch isolation enforced at the database layer." },
            { icon: ShieldCheck, title: "Enterprise security", body: "Row-level security, role-based access, audit logs, leaked-password protection." },
            { icon: GraduationCap, title: "Student portal", body: "Fee statements, exam cards, results and timetables in one branded experience." },
            { icon: BarChart3, title: "Operational insight", body: "Branch-level KPIs for admissions, finance and academics — in real time." },
          ].map((f) => (
            <div
              key={f.title}
              className="group rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-secondary text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Infinite EduSuite. All rights reserved.</p>
          <PoweredBy />
          <p>Built for institutions in Kenya and beyond.</p>
        </div>
      </footer>
    </div>
  );
}
