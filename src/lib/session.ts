import { cookies } from "next/headers";

const SESSION_COOKIE = "bizdevx_session";

export type Session = {
  projectId: string;
  memberId: string;
};

export async function setSession(session: Session) {
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function getSession(): Promise<Session | undefined> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.projectId === "string" &&
      typeof parsed.memberId === "string"
    ) {
      return { projectId: parsed.projectId, memberId: parsed.memberId };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
