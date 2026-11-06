import { requireRole } from "@/lib/server/require";
import { SettingsTabs } from "./settings-tabs";

/** Head-only settings (D5, UI-D8): underline tabs, then each page's own header. */
export default async function SettingsLayout({ children }: LayoutProps<"/staff/settings">) {
  await requireRole(["head"]);
  return (
    <div>
      <SettingsTabs />
      {children}
    </div>
  );
}
