"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { BackLink, Alert, Button } from "@/components/ui";
import { ApiError, post } from "@/lib/api";
import { useFetch } from "@/lib/client";
import type { StudentApplicationResponse } from "@/lib/types";

/** S5: record what the company replied (BR6/BR7). */
export default function ReplyPage() {
  const router = useRouter();
  const { data } = useFetch<StudentApplicationResponse>("student/application");
  const [result, setResult] = useState<"accepted" | "declined" | null>(null);
  const [file, setFile] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!data) return <p className="text-muted">Loading…</p>;
  const placement = data.application?.placements.find((p) => p.status === "letter_sent");
  if (!placement) return <Alert>There is no letter waiting for a reply.</Alert>;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await post(`student/placements/${placement!.id}/reply`, { result, acceptance_file_id: file?.id });
      router.replace("/student");
      router.refresh();
    } catch (e) {
      const x = e as ApiError;
      setError(Object.values(x.errors ?? {}).flat()[0] ?? x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <BackLink href="/student" label="home" />
      <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">What did {placement.organisation} say?</h1>
      {error ? <Alert tone="bad">{error}</Alert> : null}
      <fieldset className="grid gap-2">
        <legend className="sr-only">Company reply</legend>
        {(["accepted", "declined"] as const).map((r) => (
          <label key={r} className="flex items-center gap-3 rounded-[var(--radius)] border border-line p-3 font-semibold">
            <input type="radio" name="reply" className="size-4 accent-[var(--brand)]" checked={result === r} onChange={() => setResult(r)} />
            {r === "accepted" ? "They accepted me" : "They declined"}
          </label>
        ))}
      </fieldset>
      {result === "accepted" ? (
        <FileUpload kind="acceptance" accept="application/pdf" label={file ? `Replace (${file.name})` : "Upload the acceptance letter (PDF)"} hint="Career Services will confirm it." onUploaded={setFile} />
      ) : null}
      {result === "declined" ? <p className="text-sm text-muted">Career Services will match you to another organisation. You can also propose one.</p> : null}
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button className="flex-1" disabled={busy || !result || (result === "accepted" && !file)} onClick={submit}>
          {busy ? "Saving…" : "Submit"}
        </Button>
      </div>
    </div>
  );
}
