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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600&family=Inter:wght@400;500;600&display=swap" />
        <style>{`
          html { background: #eef4f8; color-scheme: light; }
          html, body { margin: 0; font-family: 'Inter', system-ui, sans-serif; color: var(--text, #0f1e2e); }
          body { background: var(--bg, #eef4f8); }
          /* Boot splash — pure CSS + static HTML below, visible IMMEDIATELY
             when the HTML parses, BEFORE React hydrates / styled-jsx injects
             its styles. Kills the FOUC (flash of unstyled content) that was
             showing the DOM tree in default browser fonts between the loading
             screen and the app. Fades out and removes itself once the React
             app has painted. */
          #__bootsplash {
            position: fixed; inset: 0; z-index: 9999;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 20px; padding: 0 24px; text-align: center;
            background: linear-gradient(180deg, #eef4f8 0%, #dde7ee 100%);
            transition: opacity 220ms ease-out;
          }
          #__bootsplash.gone { opacity: 0; pointer-events: none; }
          #__bs-brand {
            font-family: 'Fraunces', Georgia, serif;
            font-weight: 500; font-size: 44px; line-height: 1.1;
            letter-spacing: -0.03em;
            background: linear-gradient(135deg, #0c2a5e 0%, #1558b5 100%);
            -webkit-background-clip: text; background-clip: text;
            -webkit-text-fill-color: transparent; color: #0c2a5e;
          }
          #__bs-text {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 11px; color: #f59e0b;
            letter-spacing: 0.2em; text-transform: uppercase;
            font-weight: 500; margin: 0;
          }
          #__bs-dots { display: flex; gap: 7px; }
          #__bs-dots span {
            width: 8px; height: 8px; border-radius: 50%;
            background: #f59e0b;
            animation: bs-bounce 1.2s infinite ease-in-out both;
          }
          #__bs-dots span:nth-child(2) { animation-delay: 0.15s; background: #1558b5; }
          #__bs-dots span:nth-child(3) { animation-delay: 0.3s; }
          @keyframes bs-bounce { 0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
          /* Keep the old load-wrap classes working (page.js still uses them
             after hydration for the "Reading the ocean…" phase). */
          .load-wrap { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; padding: 0 24px; text-align: center; background: linear-gradient(180deg, var(--bg, #eef4f8) 0%, var(--bg-el, #dde7ee) 100%); z-index: 1; }
          .load-brand { font-family: 'Fraunces', Georgia, serif; font-weight: 500; font-size: 44px; line-height: 1.1; letter-spacing: -0.03em; background: linear-gradient(135deg, #0c2a5e 0%, #1558b5 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
          .load-text { font-family: 'Inter', system-ui, sans-serif; font-size: 11px; color: #f59e0b; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 500; margin: 0; }
          .load-dots { display: flex; gap: 7px; }
          .load-dot { width: 8px; height: 8px; border-radius: 50%; background: #f59e0b; animation: load-bounce 1.2s infinite ease-in-out both; }
          .load-dot:nth-child(2) { animation-delay: 0.15s; background: #1558b5; }
          .load-dot:nth-child(3) { animation-delay: 0.3s; }
          @keyframes load-bounce { 0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; } 40% { transform: scale(1); opacity: 1; } }
        `}</style>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-77RCEQZ2YS"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-77RCEQZ2YS');
        `}} />
      </head>
      <body>
        {/* Static boot splash — pure HTML, rendered immediately by the
            browser before any React / styled-jsx runs. Covers the app
            until it has fully hydrated + painted its first frame. */}
        <div id="__bootsplash">
          <div id="__bs-brand">Should You Surf?</div>
          <div id="__bs-dots"><span/><span/><span/></div>
          <p id="__bs-text">Reading the ocean…</p>
        </div>
        {children}
        <script dangerouslySetInnerHTML={{ __html: `
          // Remove the boot splash once the React tree has had a chance to
          // paint at least one frame with its real styles.
          function __hideBoot() {
            var el = document.getElementById("__bootsplash");
            if (!el) return;
            el.classList.add("gone");
            setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 260);
          }
          // Double rAF = wait one paint after layout → guarantees styles
          // are applied and content has rendered under the splash.
          if (document.readyState === "complete") {
            requestAnimationFrame(function(){ requestAnimationFrame(__hideBoot); });
          } else {
            window.addEventListener("load", function(){
              requestAnimationFrame(function(){ requestAnimationFrame(__hideBoot); });
            });
          }
          // Safety net — never let the splash stick around longer than 6 s.
          setTimeout(__hideBoot, 6000);
        `}} />
      </body>
    </html>
  );
}
