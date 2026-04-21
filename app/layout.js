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
          html, body { background: var(--bg, #eef4f8); margin: 0; font-family: 'Inter', system-ui, sans-serif; color: var(--text, #0f1e2e); }
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
      <body>{children}</body>
    </html>
  );
}
