"use client";

import { useId, useState } from "react";
import { ApiError } from "@/lib/api";
import { uploadFile } from "@/lib/client";

/** Accessible file picker that uploads straight to storage and reports the confirmed file id. */
export function FileUpload({
  kind,
  accept,
  label,
  hint,
  onUploaded,
}: {
  kind: string;
  accept: string;
  label: string;
  hint?: string;
  onUploaded: (file: { id: number; name: string }) => void | Promise<void>;
}) {
  const id = useId();
  const [state, setState] = useState<{ busy: boolean; error?: string; done?: string }>({ busy: false });

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setState({ busy: true });
    try {
      const file = await uploadFile(f, kind);
      await onUploaded(file);
      setState({ busy: false, done: file.name });
    } catch (err) {
      const ex = err as ApiError;
      setState({ busy: false, error: ex.field?.("mime") ?? ex.field?.("size") ?? ex.field?.("file") ?? ex.message });
    }
  }

  return (
    <div className="grid gap-1 rounded-[var(--radius)] border border-dashed border-line bg-surface p-4 text-center">
      <label htmlFor={id} className="cursor-pointer font-semibold text-brand">
        {state.busy ? "Uploading…" : label}
      </label>
      <input id={id} type="file" accept={accept} className="sr-only" onChange={onChange} disabled={state.busy} />
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      {state.done ? <p className="text-sm text-brand">Uploaded {state.done}</p> : null}
      {state.error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
