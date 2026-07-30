export default defineEventHandler((event) => {
  const isProd = process.env.NODE_ENV === 'production';

  setHeader(event, 'X-Frame-Options', 'DENY');
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  setHeader(event, 'Referrer-Policy', 'strict-origin-when-cross-origin');
  setHeader(event, 'Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  setHeader(event, 'X-DNS-Prefetch-Control', 'off');

  if (isProd) {
    setHeader(event, 'Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    setHeader(
      event,
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self' https:",
      ].join('; '),
    );
  }
});
