export interface PrivateValueSource {
  get(names: string[]): Promise<Record<string, string | undefined>>;
}

export class PrivateSourceUnavailable extends Error {
  constructor(message = "The private value source is unavailable") {
    super(message);
    this.name = "PrivateSourceUnavailable";
  }
}

export type PrivateEnv = Record<string, string | undefined>;
