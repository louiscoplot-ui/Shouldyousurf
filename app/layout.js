export const metadata = {
  title: "Should You Surf?",
  description: "Should you surf today? Check live conditions for beaches across Australia.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Should You Surf?",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#eef4f8",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* Apple touch startup images — shown BEFORE the HTML loads on iOS
            PWA cold start. Without these, iOS defaults to a black splash.
            Matched per device resolution so iOS picks the right one. */}
        <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1290x2796.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1284x2778.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1242x2688.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/iphone-828x1792.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1242x2208.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1179x2556.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1170x2532.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" href="/splash/iphone-1125x2436.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/iphone-750x1334.png" />
        <link rel="apple-touch-startup-image" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)" href="/splash/iphone-640x1136.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Inter:wght@400;500;600&display=swap" />
        <style>{`
          html { background: #eef4f8; color-scheme: light; }
          html, body { margin: 0; font-family: 'Inter', system-ui, sans-serif; color: var(--text, #0f1e2e); }
          body { background: var(--bg, #eef4f8); }
          /* ── Preload splash ──────────────────────────────────────────
             Rendered as static HTML at the top of <body>. Appears the
             instant the browser parses the first line of body — before
             React hydrates, before Google Fonts load, before Open-Meteo
             answers. Uses system serif (Georgia) so there's ZERO font-
             download wait. Removed by a tiny script once the React app
             signals window.__appReady. */
          #__preload {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 20px; padding: 0 24px; text-align: center;
            background: #0b2233;
            overflow: hidden;
            transition: opacity 180ms ease-out;
          }
          #__preload.gone { opacity: 0; pointer-events: none; }
          #__preload .pl-video {
            position: absolute; inset: 0;
            width: 100%; height: 100%;
            object-fit: cover;
            pointer-events: none;
          }
          #__preload .pl-veil {
            position: absolute; inset: 0;
            background:
              linear-gradient(180deg, rgba(173,202,224,0.45) 0%, rgba(118,164,200,0.55) 60%, rgba(60,108,148,0.6) 100%),
              rgba(150,190,220,0.18);
            pointer-events: none;
          }
          #__preload .pl-brand,
          #__preload .pl-dots,
          #__preload .pl-text { position: relative; z-index: 1; }
          #__preload .pl-brand {
            font-family: 'Fraunces', Georgia, 'Times New Roman', serif;
            font-style: italic;
            font-weight: 500; font-size: 44px; line-height: 1.1;
            letter-spacing: -0.025em;
            color: #fbfaf6;
            text-shadow: 0 2px 14px rgba(10,30,48,0.35);
          }
          #__preload .pl-dots { display: flex; gap: 7px; }
          #__preload .pl-dots span {
            width: 8px; height: 8px; border-radius: 50%;
            background: #f0b27a;
            animation: pl-bounce 1.2s infinite ease-in-out both;
          }
          #__preload .pl-dots span:nth-child(2) { animation-delay: 0.15s; background: #fbfaf6; }
          #__preload .pl-dots span:nth-child(3) { animation-delay: 0.3s; background: #8fc0d8; }
          #__preload .pl-text {
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 11px; color: rgba(251,250,246,0.75);
            letter-spacing: 0.2em; text-transform: uppercase;
            font-weight: 500; margin: 0;
          }
          @keyframes pl-bounce { 0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
          /* React's .load-wrap (from page.js) sits under the preload
             splash at z-index:1 — invisible to the user while preload
             is on top. Kept as safety net in case the preload has been
             removed but data is still coming. */
          .load-wrap { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 0 24px; text-align: center; background: linear-gradient(180deg, var(--bg, #eef4f8) 0%, var(--bg-el, #dde7ee) 100%); z-index: 1; }
          .load-brand { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 44px; line-height: 1.1; letter-spacing: -0.03em; background: linear-gradient(135deg, #0c2a5e 0%, #1558b5 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
          .load-text { font-family: 'Inter', system-ui, sans-serif; font-size: 11px; color: #f59e0b; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 500; margin: 0; }
          .load-dots { display: flex; gap: 7px; }
          .load-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; animation: pl-bounce 1.2s infinite ease-in-out both; }
          .load-dot:nth-child(2) { animation-delay: 0.15s; background: #1558b5; }
          .load-dot:nth-child(3) { animation-delay: 0.3s; }
        `}</style>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-77RCEQZ2YS"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-77RCEQZ2YS');
          // Recovery kill-switch. If the app hasn't signalled ready within
          // 12s (window.__appReady = true, set from page.js after first
          // data fetch completes OR the error screen renders), we assume
          // the user is stuck on a corrupt cached bundle / stale SW and
          // clear everything + reload. One-shot, per page load.
          (function() {
            var bailedAlready = false;
            setTimeout(function(){
              if (window.__appReady || bailedAlready) return;
              bailedAlready = true;
              try {
                if ("serviceWorker" in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(regs){
                    regs.forEach(function(r){ r.unregister(); });
                  });
                }
                if ("caches" in window) {
                  caches.keys().then(function(ks){
                    return Promise.all(ks.map(function(k){ return caches.delete(k); }));
                  }).then(function(){ location.reload(); });
                } else { location.reload(); }
              } catch(e) { location.reload(); }
            }, 12000);
          })();
        `}} />
      </head>
      <body>
        {/* Static preload splash — appears the INSTANT the HTML parses,
            before React hydrates / Google Fonts load. Hidden once the
            React app signals window.__appReady from page.js.
            The <video> is HTML-native (not React) so it starts loading
            with the HTML rather than after hydration. */}
        <div id="__preload">
          <video
            className="pl-video"
            src="/assets/surfer.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          />
          <div className="pl-veil" aria-hidden="true"/>
          <div className="pl-brand">Should You Surf?</div>
          <div className="pl-dots"><span/><span/><span/></div>
          <p className="pl-text">Reading the ocean…</p>
        </div>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var hidden = false;
            var startTime = Date.now();
            var MIN_SHOW = 2500;  // 2.5s so the video has enough time to play
            function hide() {
              if (hidden) return;
              hidden = true;
              var el = document.getElementById("__preload");
              if (!el) return;
              el.classList.add("gone");
              setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 220);
            }
            function tryHide() {
              var elapsed = Date.now() - startTime;
              if (elapsed >= MIN_SHOW) hide();
              else setTimeout(hide, MIN_SHOW - elapsed);
            }
            // Poll for app-ready signal from page.js (set after first
            // fetchAllDays resolves or errors).
            var tries = 0;
            var iv = setInterval(function(){
              tries++;
              if (window.__appReady) { clearInterval(iv); tryHide(); }
              // Hard ceiling at 8s — don't leave the splash stuck on
              // a broken app forever.
              else if (tries > 80) { clearInterval(iv); hide(); }
            }, 100);
          })();
        `}} />
      </body>
    </html>
  );
}
