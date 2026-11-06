import { redirect } from "next/navigation";

export default function SettingsIndex() {
  redirect("/staff/settings/staff-accounts");
}
