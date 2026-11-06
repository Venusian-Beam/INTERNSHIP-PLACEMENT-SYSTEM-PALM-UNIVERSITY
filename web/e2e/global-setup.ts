import { execSync } from "node:child_process";
import path from "node:path";

/** Fresh, deterministic demo data before the browser journeys run. */
export default function globalSetup() {
  const api = path.resolve(__dirname, "../../api");
  execSync("php artisan migrate:fresh --seed --force", { cwd: api, stdio: "inherit" });
  execSync("php artisan cache:clear", { cwd: api, stdio: "inherit" }); // reset rate-limit counters
}
