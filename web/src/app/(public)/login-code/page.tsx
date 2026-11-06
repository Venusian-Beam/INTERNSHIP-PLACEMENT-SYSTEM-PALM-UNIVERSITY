import { redirect } from "next/navigation";

/** P5 lives inside the sign-in flow (the code step needs the challenge from the password step). */
export default function LoginCodePage() {
  redirect("/sign-in");
}
