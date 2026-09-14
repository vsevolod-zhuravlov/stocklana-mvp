"use client";

import * as React from "react";

export function ServiceWorker() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Registering after load keeps the worker off the critical path for the
    // first paint, which matters on the phone used for the demo recording.
    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a progressive enhancement; the app works without it.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
