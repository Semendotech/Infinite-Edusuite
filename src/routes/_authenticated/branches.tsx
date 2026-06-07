import { createFileRoute, Link } from "@tanstack/react-router";
import { requireAnyPermission } from "@/core/auth/route-guards";
import { BRANCH_MANAGE_PERMISSIONS } from "@/config/access.config";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Building2, Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(20).regex(/^[A-Z0-9_-]+$/, "Use A-Z, 0-9, _ or -"),
  city: z.string().trim().max(80).optional().or(z.literal("")),
});

export const Route = createFileRoute("/_authenticated/branches")({
  head: () => ({ meta: [{ title: "Branches — Infinite EduSuite" }] }),
  beforeLoad: ({ context }) => {
    requireAnyPermission(context.auth, BRANCH_MANAGE_PERMISSIONS);
  },
  component: BranchesPage,
});

function BranchesPage() {
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, code, city, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      code: (fd.get("code") as string).toUpperCase(),
      city: fd.get("city"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("branches").insert({
      name: parsed.data.name,
      code: parsed.data.code,
      city: parsed.data.city || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Branch created");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["branches"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Branches</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your campus branches.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-sm)" }}>
            {isLoading ? (
              <div className="grid place-items-center p-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : !data?.length ? (
              <div className="p-12 text-center">
                <Building2 className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No branches yet</p>
                <p className="text-xs text-muted-foreground">Create your first branch on the right.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {data.map((b) => (
                  <li key={b.id} className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.code}{b.city ? ` • ${b.city}` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${b.is_active ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={onSubmit} className="h-fit rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <h2 className="text-sm font-semibold">New branch</h2>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required maxLength={120} placeholder="Nairobi Main" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="code">Code</Label>
                <Input id="code" name="code" required maxLength={20} placeholder="NRB-MAIN" className="uppercase" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" maxLength={80} placeholder="Nairobi" />
              </div>
            </div>
            <Button type="submit" className="mt-4 w-full" disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Create branch
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}