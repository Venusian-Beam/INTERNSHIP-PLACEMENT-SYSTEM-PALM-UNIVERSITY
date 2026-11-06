"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { api, ApiError, post } from "@/lib/api";

type Account = { id: number; name: string; email: string; role: string; is_active: boolean; last_login_at: string | null };
type Invite = { id: number; name: string; email: string; role: string; expires_at: string };
const roleLabel: Record<string, string> = { staff: "Staff", head: "Head", president: "President" };

/** H1: Head invites staff, Head or President, and deactivates accounts (FR-A4, FR-A8). */
export default function StaffAccountsPage() {
  const [data, setData] = useState<{ users: Account[]; invitations: Invite[] } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", role: "staff" });
  const [error, setError] = useState<ApiError | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<{ users: Account[]; invitations: Invite[] }>("staff/accounts").then(setData).catch(setError), []);
  useEffect(() => {
    load();
  }, [load]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const r = await post<{ message: string }>("staff/invitations", form);
      setMsg(r.message);
      setForm({ name: "", email: "", role: "staff" });
      load();
    } catch (err) {
      setError(err as ApiError);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(u: Account) {
    setMsg(null);
    try {
      const r = await post<{ message: string }>(`staff/accounts/${u.id}`, { is_active: !u.is_active }, "PATCH");
      setMsg(r.message);
      load();
    } catch (err) {
      setError(err as ApiError);
    }
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        back={{ href: "/staff", label: "Dashboard" }}
        crumbs={[{ label: "Home", href: "/staff" }, { label: "Settings" }, { label: "Staff accounts" }]}
        title="Staff accounts" sub="Invite Career Services staff, the Head or the President. They sign in with a password and an emailed code." />
      {msg ? <Alert tone="ok">{msg}</Alert> : null}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left [&>th]:border-b [&>th]:border-line [&>th]:bg-surface/60 [&>th]:text-[12.5px] [&>th]:font-semibold [&>th]:whitespace-nowrap [&>th]:text-muted">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <b>{u.name}</b>
                    <div className="text-muted">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">{roleLabel[u.role]}</td>
                  <td className="px-4 py-3">{u.is_active ? <Badge tone="ok">Active</Badge> : <Badge tone="bad">Deactivated</Badge>}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant={u.is_active ? "danger" : "secondary"} className="min-h-8 px-3 text-sm" onClick={() => toggle(u)}>
                      {u.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
              {data?.invitations.map((i) => (
                <tr key={`i${i.id}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <b>{i.name}</b>
                    <div className="text-muted">{i.email}</div>
                  </td>
                  <td className="px-4 py-3">{roleLabel[i.role]}</td>
                  <td className="px-4 py-3">
                    <Badge tone="warn">Invited</Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted">expires {new Date(i.expires_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data ? <p className="p-4 text-muted">Loading…</p> : null}
        </Card>
        <Card>
          <form onSubmit={invite} className="grid gap-3" noValidate>
            <h2 className="font-bold">Invite someone</h2>
            {error && !Object.keys(error.errors).length ? <Alert tone="bad">{error.message}</Alert> : null}
            <Field id="inv-name" label="Name" error={error?.field("name")}>
              <Input id="inv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field id="inv-email" label="Email" error={error?.field("email")}>
              <Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field id="inv-role" label="Role" error={error?.field("role")}>
              <Select id="inv-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="staff">Career Services staff</option>
                <option value="head">Head of Career Services</option>
                <option value="president">President (template approval only)</option>
              </Select>
            </Field>
            <Button type="submit" disabled={busy || !form.name || !form.email}>
              {busy ? "Sending…" : "Send invitation"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
