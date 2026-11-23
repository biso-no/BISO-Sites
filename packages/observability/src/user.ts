import { setUser } from "@sentry/core";

export const setSentryUser = (id: string | null | undefined): void => {
  setUser(id ? { id } : null);
};
