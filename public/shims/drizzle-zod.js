// Lightweight shim for drizzle-zod used to avoid runtime import errors in the browser.
// Provide chainable schema helpers used by the client bundle: omit, extend, partial, pick.

// Stable chainable & callable schema shim for drizzle-zod.
// Some downstream code may attempt to invoke the schema like a function after chaining.
// We emulate this by making the target a function proxy that always returns itself.

function makeSchema(init = {}) {
	const targetFn = function _dzShimCallable() { return proxy; };
	const state = { __drizzleZodShim: true, ...init };
	const proxy = new Proxy(targetFn, {
		get(_t, prop) {
			if (prop === '__isDrizzleZodShim') return true;
			if (prop in state) return state[prop];
			if (prop === 'parse') return (v) => v;
			if (prop === 'safeParse') return (v) => ({ success: true, data: v });
			if (prop === 'toJSON') return () => state;
			// Known chainable builders just return proxy
			if (['omit','extend','partial','pick','default','shape','merge','required','optional'].includes(prop)) {
				return () => proxy;
			}
			// Unknown properties produce a chainable no-op function
			return proxy;
		},
		apply() { return proxy; },
	});
	return proxy;
}

export const createInsertSchema = (table, _opts) => makeSchema({ table });
export const createUpdateSchema = (table, _opts) => makeSchema({ table });
export const createSelectSchema = (table, _opts) => makeSchema({ table });

export default { createInsertSchema, createUpdateSchema, createSelectSchema };
