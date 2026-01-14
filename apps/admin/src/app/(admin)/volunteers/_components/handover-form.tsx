"use client";
import { useState } from "react";

export default function HandoverForm() {
  const [roleMailbox, setRoleMailbox] = useState("");
  const [newDelegate, setNewDelegate] = useState("");
  const [oldDelegate, setOldDelegate] = useState("");
  const [result, setResult] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const res = await fetch("/api/handover-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleMailbox, newDelegate, oldDelegate }),
    });

    const data = await res.json();
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <div className="p-4">
      <form className="space-y-2" onSubmit={handleSubmit}>
        <input
          className="w-full rounded border p-2"
          onChange={(e) => setRoleMailbox(e.target.value)}
          placeholder="Role mailbox (e.g. controller.oslo@biso.no)"
          type="text"
          value={roleMailbox}
        />
        <input
          className="w-full rounded border p-2"
          onChange={(e) => setNewDelegate(e.target.value)}
          placeholder="New delegate (firstname.lastname@biso.no)"
          type="text"
          value={newDelegate}
        />
        <input
          className="w-full rounded border p-2"
          onChange={(e) => setOldDelegate(e.target.value)}
          placeholder="Old delegate (optional)"
          type="text"
          value={oldDelegate}
        />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          type="submit"
        >
          Handover
        </button>
      </form>
      {result && (
        <pre className="mt-4 rounded border bg-gray-100 p-2">{result}</pre>
      )}
    </div>
  );
}
