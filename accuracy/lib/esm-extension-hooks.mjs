// Resolve hook used by register-esm.mjs (runs in Node's loader thread).
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (err) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    const hasExt = /\.[cm]?js$|\.json$/.test(specifier);
    if (err?.code === "ERR_MODULE_NOT_FOUND" && relative && !hasExt) {
      return next(`${specifier}.js`, context);
    }
    throw err;
  }
}
