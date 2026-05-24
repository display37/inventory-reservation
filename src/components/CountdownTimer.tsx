"use client";

import { useEffect, useState } from "react";

interface Props {
  expiresAt: string;
  onExpire?: () => void;
}

export function CountdownTimer({ expiresAt, onExpire }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (secondsLeft <= 0) {
      onExpire?.();
      return;
    }
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          onExpire?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const isUrgent = secondsLeft < 60;

  return (
    <span className={`font-mono font-semibold ${isUrgent ? "text-red-500" : "text-amber-600"}`}>
      {mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}
