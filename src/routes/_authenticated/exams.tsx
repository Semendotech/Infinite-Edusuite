import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/core/auth/route-guards";
import { Permission } from "@/core/rbac/permissions";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, FileText, Loader2, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const schema = z.object({
  branch_id: z.string().uuid("Pick a branch"),
  name: z.string().trim().min(2).max(120),
  course_id: z.string().uuid().optional().or(z.literal("")),
  exam_date: z.string().optional().or(z.literal("")),
  venue: z.string().trim().max(120).optional().or(z.literal("")),
});

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({ meta: [{ title: "Exams — Infinite EduSuite" }] }),
  beforeLoad: ({ context }) => {
    requirePermission(context.auth, Permission.EXAM_VIEW);
  },
  component: ExamsPage,
});

function ExamsPage() {
  const { auth } = Route.useRouteContext();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const branches = useQuery({
    queryKey: ["branches", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("id, code, name")
        .is("deleted_at", null)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const exams = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("id, name, exam_date, venue, status, branch_id, course_id, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = exams.data?.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setSubmitting(true);
    try {
      const { error } = await supabase.from("exams").insert({
        branch_id: parsed.data.branch_id,
        name: parsed.data.name,
        course_id: parsed.data.course_id || null,
        exam_date: parsed.data.exam_date || null,
        venue: parsed.data.venue || null,
      });

      if (error) throw error;

      toast.success("Exam scheduled");
      (e.target as HTMLFormElement).reset();
      qc.invalidateQueries({ queryKey: ["exams"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to schedule exam");
    } finally {
      setSubmitting(false);
    }
  }

  const getExamStatus = (examDate?: string | null, status?: string | null) => {
    if (!examDate) {
      if (!status) return "Unknown";
      return `${status.charAt(0).toUpperCase()}${status.slice(1).toLowerCase()}`;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const examDay = new Date(new Date(examDate).getFullYear(), new Date(examDate).getMonth(), new Date(examDate).getDate());

    if (today.getTime() === examDay.getTime()) return "Ongoing";
    return today < examDay ? "Scheduled" : "Closed";
  };

  const getStatusColor = (status: string) => {
    if (status === "Closed") return "bg-slate-100 text-slate-800";
    if (status === "Ongoing") return "bg-emerald-100 text-emerald-800";
    if (status === "Scheduled") return "bg-blue-100 text-blue-800";
    if (status.toLowerCase() === "completed") return "bg-green-100 text-green-800";
    if (status.toLowerCase() === "cancelled") return "bg-red-100 text-red-800";
    return "bg-blue-100 text-blue-800";
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Exams</h1>
        <p className="mt-1 text-sm text-muted-foreground">Schedule and manage exams.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exams..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-sm)" }}>
              {exams.isLoading ? (
                <div className="grid place-items-center p-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !filtered?.length ? (
                <div className="p-12 text-center">
                  <FileText className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm font-medium">No exams yet</p>
                  <p className="text-xs text-muted-foreground">Schedule your first exam on the right.</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">Name</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Venue</th>
                      <th className="px-4 py-3 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered?.map((e) => (
                      <tr key={e.id}>
                        <td className="px-4 py-3 font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {e.exam_date ? new Date(e.exam_date).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{e.venue || "—"}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const examStatus = getExamStatus(e.exam_date, e.status);
                            return (
                              <Badge className={getStatusColor(examStatus)}>
                                {examStatus}
                              </Badge>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <form onSubmit={onSubmit} className="h-fit rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h2 className="text-sm font-semibold">Schedule exam</h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="branch_id">Branch</Label>
                <select
                  id="branch_id"
                  name="branch_id"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                >
                  <option value="">Select a branch…</option>
                  {branches.data?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Exam Name</Label>
                <Input id="name" name="name" required maxLength={120} placeholder="Midterm Mathematics" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course_id">Course (optional)</Label>
                <select
                  id="course_id"
                  name="course_id"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                >
                  <option value="">Select a course…</option>
                  {courses.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exam_date">Exam Date</Label>
                <Input id="exam_date" name="exam_date" type="date" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue">Venue (optional)</Label>
                <Input id="venue" name="venue" maxLength={120} placeholder="Hall A" />
              </div>
            </div>
            <Button type="submit" className="mt-4 w-full" disabled={submitting || !branches.data?.length}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Schedule exam
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
