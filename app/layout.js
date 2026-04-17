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
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-77RCEQZ2YS"></script>
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-77RCEQZ2YS');
        `}} />
      </head>
      <body style={{ margin: 0, background: "#060d12" }}>{children}</body>
    </html>
  );
}
