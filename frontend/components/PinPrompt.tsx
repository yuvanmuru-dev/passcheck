"use client";

import { useState } from "react";

/** Manager PIN entry. The PIN is kept in this browser's localStorage and sent as X-Manager-Pin. */
export default function PinPrompt({ wrong, onSubmit }: { wrong: boolean; onSubmit: (pin: string) => void }) {
  const [pin, setPin] = useState("");
  return (
    <form
      className="card mx-auto mt-16 flex w-full max-w-sm flex-col gap-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (pin.trim()) onSubmit(pin.trim());
      }}
    >
      <h1 className="text-xl">Manager PIN</h1>
      <p className="text-sm text-mute">Disputes and insights are for managers. Enter the PIN to continue.</p>
      <label className="flex flex-col gap-1">
        <span className="label">PIN</span>
        <input
          className="input mono text-lg tracking-[0.3em]"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-invalid={wrong}
        />
      </label>
      {wrong && <div className="note-err" role="alert">That PIN didn&apos;t work. Try again.</div>}
      <button className="btn btn-gold" type="submit" disabled={!pin.trim()}>
        Unlock
      </button>
    </form>
  );
}
