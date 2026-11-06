"use client";

import { FileUpload } from "@/components/file-upload";
import { BackLink, Alert, Card } from "@/components/ui";
import { post } from "@/lib/api";
import { openFile, useFetch } from "@/lib/client";
import type { StudentApplicationResponse } from "@/lib/types";

type Me = { user: { profile: { cv_file_id: number | null } } };

/** S6: my documents. CV here; letter copy (D8), acceptance letter and report appear once a placement exists. */
export default function DocumentsPage() {
  const me = useFetch<Me>("auth/me");
  const app = useFetch<StudentApplicationResponse>("student/application");
  if (!me.data || !app.data) return <p className="text-muted">Loading…</p>;
  const cv = me.data.user.profile.cv_file_id;
  const placement = app.data.application?.placements.find((p) => p.status !== "declined");

  return (
    <div className="grid gap-4">
      <BackLink href="/student" label="home" />
      <h1 className="text-[20px] leading-tight font-semibold tracking-[-0.01em]">Documents</h1>
      <Card className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">CV</h2>
          {cv ? (
            <button className="text-sm font-semibold text-brand" onClick={() => openFile(cv)}>
              View
            </button>
          ) : null}
        </div>
        <FileUpload
          kind="cv"
          accept="application/pdf"
          label={cv ? "Replace CV (PDF)" : "Upload CV (PDF)"}
          hint="PDF only, up to 4 MB."
          onUploaded={async (f) => {
            await post("student/profile", { cv_file_id: f.id }, "PATCH");
            await me.reload();
          }}
        />
      </Card>
      {placement?.letter?.pdf_file_id ? (
        <Card className="flex items-center justify-between">
          <span>Letter {placement.letter.reference_no}</span>
          <button className="text-sm font-semibold text-brand" onClick={() => openFile(placement.letter!.pdf_file_id!)}>
            View
          </button>
        </Card>
      ) : null}
      {placement?.acceptance_file_id ? (
        <Card className="flex items-center justify-between">
          <span>Acceptance letter</span>
          <button className="text-sm font-semibold text-brand" onClick={() => openFile(placement.acceptance_file_id!)}>
            View
          </button>
        </Card>
      ) : null}
      {placement?.status === "accepted" || placement?.report_file_id ? (
        <Card className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Internship report</h2>
            {placement.report_file_id ? (
              <button className="text-sm font-semibold text-brand" onClick={() => openFile(placement.report_file_id!)}>
                View
              </button>
            ) : null}
          </div>
          {placement.status === "accepted" ? (
            <FileUpload
              kind="report"
              accept="application/pdf"
              label={placement.report_file_id ? "Replace report (PDF)" : "Upload your report (PDF)"}
              hint="Upload after your internship ends."
              onUploaded={async (f) => {
                await post(`student/placements/${placement.id}/report`, { file_id: f.id });
                await app.reload();
              }}
            />
          ) : null}
        </Card>
      ) : null}
      {!placement ? <Alert>Your letter, acceptance letter and internship report will appear here once you are placed.</Alert> : null}
    </div>
  );
}
