"use client";

// v2 PwaInstallPrompt — bottom banner; detects iOS Safari + in-app browsers.

import { useEffect, useState } from "react";

export default function PwaInstallPrompt({ onDismiss, t }) {
  const [isIos, setIsIos] = useState(false);
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsIos(/iPhone|iPad|iPod/.test(ua));
    setInApp(/Instagram|FBAN|FBAV|FB_IAB|FBIOS|Line\/|MicroMessenger|KAKAOTALK|TikTok|musical_ly|Snapchat|LinkedInApp|Twitter|Pinterest/i.test(ua));
  }, []);
  const title = inApp ? t("pwa_inapp_title") : t("pwa_title");
  const instructions = inApp ? t("pwa_inapp") : (isIos ? t("pwa_ios") : t("pwa_android"));
  return (
    <div className="v2-pwa-banner">
      <div className="v2-pwa-icon">{inApp ? "🔗" : "🏄"}</div>
      <div className="v2-pwa-content">
        <div className="v2-pwa-title">{title}</div>
        <div className="v2-pwa-instructions">{instructions}</div>
      </div>
      <button className="v2-pwa-close" onClick={onDismiss}>✕</button>
    </div>
  );
}
