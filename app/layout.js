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
  themeColor: "#f5efe5",
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
          html, body { background: #f5efe5; margin: 0; font-family: 'Inter', system-ui, sans-serif; color: #141a24; }
          .load-wrap { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; padding: 0 24px; text-align: center; background: radial-gradient(ellipse at top, #f5efe5 0%, #ece4d3 100%); z-index: 1; }
          .load-brand { font-family: 'Fraunces', Georgia, serif; font-style: italic; font-weight: 500; font-size: 52px; line-height: 1; letter-spacing: -0.035em; color: #141a24; }
          .load-brand em { font-style: italic; color: #c7422a; }
          .load-text { font-family: 'Inter', system-ui, sans-serif; font-size: 10px; color: #c7422a; letter-spacing: 0.32em; text-transform: uppercase; font-weight: 500; margin: 0; }
          .load-dots { display: flex; gap: 6px; }
          .load-dot { width: 6px; height: 6px; border-radius: 50%; background: #c7422a; animation: load-bounce 1.3s infinite ease-in-out both; }
          .load-dot:nth-child(2) { animation-delay: 0.18s; background: #2d5a6b; }
          .load-dot:nth-child(3) { animation-delay: 0.36s; background: #c9a876; }
          @keyframes load-bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
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
