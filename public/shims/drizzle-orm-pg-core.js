// Enhanced lightweight shim for drizzle-orm/pg-core.
// Provides extremely permissive fluent builders so any chain of method calls is a no-op.
// This prevents minified production bundles from throwing when expecting real drizzle objects.

function makeFluent(base){
  const proxy = new Proxy(base, {
    get(target, prop){
      if (prop === '__isDrizzleShim') return true;
      if (prop === 'toJSON') return () => target;
      if (prop === 'valueOf') return () => target;
      if (prop === 'references') {
        return () => proxy; // ignore FK constraints
      }
      // Any accessed property becomes a chainable function returning the proxy
      if (!(prop in target)) {
        target[prop] = () => proxy; // lazily define to keep enumeration small
      }
      const val = target[prop];
      if (typeof val === 'function') {
        return (..._args) => proxy; // swallow args
      }
      return proxy; // non-function access also returns proxy to allow accidental invocation
    },
    apply(){
      return proxy;
    }
  });
  return proxy;
}

function makeColumn(type, name){
  return makeFluent({ type, name });
}

export function pgTable(name, cols, relations){
  // Support both object and function-style second argument like drizzle's API.
  let columns = cols;
  if (typeof cols === 'function') {
    // Provide a minimal column factory param for the callback
    columns = cols({});
  }
  const table = makeFluent({ __pgTableShim: true, name, columns });
  if (typeof relations === 'function') {
    try { relations(() => ({})); } catch { /* ignore */ }
  }
  return table;
}

export const serial = (name) => makeColumn('serial', name);
export const text = (name) => makeColumn('text', name);
export const integer = (name) => makeColumn('integer', name);
export const timestamp = (name) => makeColumn('timestamp', name);
export const boolean = (name) => makeColumn('boolean', name);

export default { pgTable, serial, text, integer, timestamp, boolean };
