# Checklist de seguridad Luxtime (pre-deploy)

- [ ] Rate limiting activo en pre-pedidos y auth
- [ ] Helmet y CORS restringido a dominios productivos
- [ ] Cookies httpOnly + SameSite
- [ ] ADMIN sin acceso a endpoints `@Financial()`
- [ ] Secretos solo en variables de entorno
- [ ] Cloudflare WAF delante de Vercel y Cloud Run
- [ ] Sentry configurado con `SENTRY_DSN`
- [ ] Validación `class-validator` en todos los DTOs públicos
- [ ] Backups diarios Cloud SQL documentados
