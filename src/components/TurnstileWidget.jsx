import { useEffect, useRef, useState } from "react";

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
let widgetScript;

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!widgetScript) {
    widgetScript = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const fail = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error("Could not load verification"));
      };
      const timeout = setTimeout(fail, 10_000);
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = () => {
        if (!window.turnstile) return fail();
        clearTimeout(timeout);
        resolve(window.turnstile);
      };
      script.onerror = fail;
      document.head.append(script);
    }).catch(error => {
      widgetScript = undefined;
      throw error;
    });
  }
  return widgetScript;
}

export default function TurnstileWidget({ action, onToken }) {
  const container = useRef(null);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!siteKey) return;
    const target = container.current;
    let active = true;
    let widget;
    let turnstile;
    const fail = () => {
      if (active) {
        onToken(null);
        setUnavailable(true);
      }
      return true;
    };

    loadTurnstile().then(api => {
      if (!active) return;
      turnstile = api;
      widget = api.render(target, {
        sitekey: siteKey,
        action,
        appearance: "interaction-only",
        size: target.clientWidth < 300 ? "compact" : "flexible",
        retry: "never",
        "response-field": false,
        "refresh-expired": "auto",
        callback: token => {
          if (active) onToken(token);
        },
        "expired-callback": () => {
          if (active) onToken(null);
        },
        "timeout-callback": fail,
        "error-callback": fail,
      });
    }).catch(fail);

    return () => {
      active = false;
      if (widget !== undefined) turnstile.remove(widget);
    };
  }, [action, attempt, onToken]);

  if (!siteKey) return null;
  return (
    <div>
      <div ref={container} />
      {unavailable && (
        <div className="text-sm">
          <p role="status">The security check didn’t load.</p>
          <button type="button" className="underline" onClick={() => {
            setUnavailable(false);
            setAttempt(value => value + 1);
          }}>Retry security check</button>
        </div>
      )}
    </div>
  );
}
