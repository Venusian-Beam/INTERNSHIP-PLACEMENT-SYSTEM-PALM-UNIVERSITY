"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError, post } from "./api";

/** Load JSON through the proxy, with loading/error state and a reload function. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!path);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path));
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [path]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch on mount / when the path changes
    reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

/** Open a private file through a short-lived signed link (FR-X3). */
export async function openFile(fileId: number, inline = true) {
  const { url } = await api<{ url: string }>(`files/${fileId}/download${inline ? "?inline=1" : ""}`);
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Upload straight to object storage (AD6): ask the API for a presigned URL, PUT the bytes, then confirm
 * so the API can verify size and file signature.
 */
export async function uploadFile(file: File, kind: string): Promise<{ id: number; name: string }> {
  const mime = file.type || (file.name.toLowerCase().endsWith(".csv") ? "text/csv" : "application/octet-stream");
  const p = await post<{ file_id: number; url: string; fields: Record<string, string> }>("files/uploads", {
    kind,
    mime,
    size: file.size,
    name: file.name,
  });
  // Presigned POST policy (QA-2-01): storage rejects anything outside the declared size/type.
  const form = new FormData();
  for (const [k, v] of Object.entries(p.fields)) form.append(k, v);
  form.append("file", file);
  const up = await fetch(p.url, { method: "POST", body: form });
  if (!up.ok) throw new ApiError(up.status, "The upload failed. Check your connection and try again.");
  const r = await post<{ file: { id: number; name: string } }>(`files/${p.file_id}/confirm`);
  return r.file;
}

export const STAGES: Record<string, { label: string; tone: "info" | "ok" | "warn" | "bad" | "neutral" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  draft: { label: "Draft", tone: "neutral" },
  applied: { label: "Applied", tone: "info" },
  not_recommended: { label: "Not recommended", tone: "bad" },
  matched: { label: "Matched", tone: "ok" },
  letter_sent: { label: "Letter sent", tone: "info" },
  acceptance_submitted: { label: "Acceptance submitted", tone: "warn" },
  accepted: { label: "Accepted", tone: "ok" },
  needs_rematch: { label: "Needs re-match", tone: "bad" },
  completed: { label: "Completed", tone: "ok" },
};

export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
