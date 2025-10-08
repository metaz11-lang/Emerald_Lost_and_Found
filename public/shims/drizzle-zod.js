// Lightweight shim for drizzle-zod used to avoid runtime import errors in the browser.
// Provide chainable schema helpers used by the client bundle: omit, extend, partial, pick.

// Stable chainable schema shim for drizzle-zod.
// Provides the methods used in the bundle (omit, extend, partial, pick, default) and
// gracefully absorbs any additional chained method names without throwing.

function makeSchema(init = {}) {
	const base = { __drizzleZodShim: true, ...init };
	const self = new Proxy(base, {
		get(_t, prop) {
			if (prop === '__isDrizzleZodShim') return true;
			// Known chainable methods
			if (['omit','extend','partial','pick','default','shape','merge','required','optional'].includes(prop)) {
				return () => self;
			}
			// parse / safeParse return predictable shapes
			if (prop === 'parse') return (v) => v;
			if (prop === 'safeParse') return (v) => ({ success: true, data: v });
			// Any unknown property returns self to keep chains intact
			return self;
		},
		apply() { return self; }
	});
	return self;
}

export const createInsertSchema = (table, _opts) => makeSchema({ table });
export const createUpdateSchema = (table, _opts) => makeSchema({ table });
export const createSelectSchema = (table, _opts) => makeSchema({ table });

export default { createInsertSchema, createUpdateSchema, createSelectSchema };
