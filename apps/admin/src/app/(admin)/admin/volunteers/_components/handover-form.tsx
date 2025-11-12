"use client"
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
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="text"
          placeholder="Role mailbox (e.g. controller.oslo@biso.no)"
          value={roleMailbox}
          onChange={(e) => setRoleMailbox(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          placeholder="New delegate (firstname.lastname@biso.no)"
          value={newDelegate}
          onChange={(e) => setNewDelegate(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          placeholder="Old delegate (optional)"
          value={oldDelegate}
          onChange={(e) => setOldDelegate(e.target.value)}
          className="border p-2 rounded w-full"
        />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Handover
        </button>
      </form>
      {result && (
        <pre className="mt-4 p-2 bg-gray-100 border rounded">{result}</pre>
      )}
    </div>
  );
}
