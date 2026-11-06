"use client";

import { useState } from "react";
import { ProposeOrg } from "@/components/propose-org";
import { BackLink, Alert } from "@/components/ui";

/** S3 (standalone): e.g. after a decline or a rejected proposal (BR3/BR6). */
export default function ProposePage() {
  const [done, setDone] = useState<string | null>(null);
  return (
    <div className="grid gap-4">
      <BackLink href="/student" label="home" />
      <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">Propose an organisation</h1>
      {done ? <Alert tone="ok">{done} was sent to Career Services for checking.</Alert> : null}
      <ProposeOrg onCreated={(o) => setDone(o.name)} />
    </div>
  );
}
