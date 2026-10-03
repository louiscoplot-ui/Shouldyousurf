export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) {
    if ((spec.startsWith('.') || spec.startsWith('/')) && !/\.\w+$/.test(spec)) return next(spec + '.js', ctx);
    throw e;
  }
}
export async function load(url, ctx, next) {
  if (url.includes('/app/') && url.endsWith('.js')) return next(url, { ...ctx, format: 'module' });
  return next(url, ctx);
}
