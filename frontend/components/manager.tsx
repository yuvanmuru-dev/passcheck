"use client";

import { useSyncExternalStore } from "react";
import { ApiError, managerPin, USE_MOCKS } from "@/lib/api";

const pinKey = "passcheck-manager-pin";

function subscribe(callback: () => void) {
  window.addEventListener("passcheck-pin", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("passcheck-pin", callback);
    window.removeEventListener("storage", callback);
  };
}

export function usePin() {
  return useSyncExternalStore(subscribe, managerPin, () => "");
}

export function savePin(pin: string) {
  if (pin) localStorage.setItem(pinKey, pin);
  else localStorage.removeItem(pinKey);
  window.dispatchEvent(new Event("passcheck-pin"));
}

export function isPinError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export function PinPrompt({ invalid = false }: { invalid?: boolean }) {
  return <form className="panel stack pin-panel" onSubmit={event => {
    event.preventDefault();
    const pin = new FormData(event.currentTarget).get("pin")?.toString().trim();
    if (pin) savePin(pin);
  }}>
    <h2>Manager access</h2>
    <label htmlFor="manager-pin">Manager PIN</label>
    <input required id="manager-pin" name="pin" type="password" inputMode="numeric" autoComplete="off" />
    {invalid && <p role="alert" className="red">That PIN didn’t work. Try again.</p>}
    {USE_MOCKS && <p className="muted">Demo PIN: 4242</p>}
    <button className="primary">Unlock</button>
  </form>;
}
