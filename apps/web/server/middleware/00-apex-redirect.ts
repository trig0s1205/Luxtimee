import { apexRedirectTarget, requestHost } from '../utils/apex-redirect';

export default defineEventHandler((event) => {
  const host = requestHost(
    getRequestHeader(event, 'x-forwarded-host'),
    getRequestHeader(event, 'host'),
  );
  const url = getRequestURL(event);
  const target = apexRedirectTarget(host, url.pathname, url.search);
  if (!target) return;
  return sendRedirect(event, target, 308);
});
