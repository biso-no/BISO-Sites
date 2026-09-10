import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { createServer, type Server, type Socket } from "node:net";

mock.module("server-only", () => ({}));

const { sendEmail } = await import("./smtp");

const STARTTLS_ERROR = /STARTTLS/i;

/** Minimal plaintext SMTP server that records the DATA payload it receives. */
function startFakeSmtp(options: {
  offerStartTls: boolean;
}): Promise<{ server: Server; port: number; received: string[] }> {
  const received: string[] = [];
  const server = createServer((socket: Socket) => {
    let inData = false;
    let buffer = "";
    socket.write("220 fake.test ESMTP\r\n");
    socket.on("data", (chunk) => {
      const text = chunk.toString();
      if (inData) {
        buffer += text;
        if (buffer.includes("\r\n.\r\n")) {
          received.push(buffer);
          inData = false;
          buffer = "";
          socket.write("250 2.0.0 Ok: queued\r\n");
        }
        return;
      }
      for (const line of text.split("\r\n").filter(Boolean)) {
        const verb = line.split(" ")[0]?.toUpperCase();
        if (verb === "EHLO" || verb === "HELO") {
          socket.write(
            options.offerStartTls
              ? "250-fake.test\r\n250-STARTTLS\r\n250 8BITMIME\r\n"
              : "250-fake.test\r\n250 8BITMIME\r\n"
          );
        } else if (verb === "STARTTLS") {
          // What a relay without STARTTLS actually answers. Answering "250 Ok"
          // here instead would start a TLS handshake this server cannot
          // complete, and the send would hang to its socket timeout rather
          // than failing — an artefact of the fake, not of the transport.
          socket.write("502 5.5.1 Command not implemented\r\n");
        } else if (verb === "MAIL" || verb === "RCPT") {
          socket.write("250 2.1.0 Ok\r\n");
        } else if (verb === "DATA") {
          inData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (verb === "QUIT") {
          socket.write("221 2.0.0 Bye\r\n");
          socket.end();
        } else {
          socket.write("250 2.0.0 Ok\r\n");
        }
      }
    });
    socket.on("error", () => undefined);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ server, port, received });
    });
  });
}

let fake: Awaited<ReturnType<typeof startFakeSmtp>>;

beforeAll(async () => {
  fake = await startFakeSmtp({ offerStartTls: false });
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(fake.port);
  process.env.SMTP_FROM = "BISO Varsling <noreply@biso.no>";
  Reflect.deleteProperty(process.env, "SMTP_USER");
  Reflect.deleteProperty(process.env, "SMTP_PASSWORD");
  Reflect.deleteProperty(process.env, "SMTP_SECURE");
});

afterAll(() => {
  fake.server.close();
});

describe("sendEmail against a real SMTP conversation", () => {
  test("refuses a relay that cannot do STARTTLS, and fails fast", async () => {
    Reflect.deleteProperty(process.env, "SMTP_ALLOW_INSECURE");

    // The whole point of requireTLS: a relay with no STARTTLS is a failed
    // send, not a quiet plaintext one. It must also fail promptly — a reporter
    // waiting out a socket timeout is its own kind of broken.
    const started = Date.now();
    await expect(
      sendEmail({
        html: "<p>hei</p>",
        subject: "BISO Varsling: Trakassering",
        to: "hr@biso.no",
      })
    ).rejects.toThrow(STARTTLS_ERROR);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  test("delivers the report once the TLS requirement is waived", async () => {
    process.env.SMTP_ALLOW_INSECURE = "true";

    const result = await sendEmail({
      html: "<p>Noe kritikkverdig</p>",
      replyTo: "reporter@example.com",
      subject: "BISO Varsling: Trakassering",
      text: "Noe kritikkverdig",
      to: "hr@biso.no",
    });

    expect(result.accepted).toContain("hr@biso.no");

    const wire = fake.received.at(-1) ?? "";
    expect(wire).toContain("Subject: BISO Varsling");
    expect(wire).toContain("hr@biso.no");
    expect(wire).toContain("Reply-To: reporter@example.com");
    // Both parts present — the text alternative is what keeps it out of junk.
    expect(wire).toContain("multipart/alternative");
  });
});
