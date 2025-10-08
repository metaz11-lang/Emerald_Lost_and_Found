// Lightweight shim for drizzle-zod used to avoid runtime import errors in the browser.
// Provide chainable schema helpers used by the client bundle: omit, extend, partial, pick.

function makeFluent(base){
	return new Proxy(base, {
		get(target, prop){
			if (prop === '__isDrizzleZodShim') return true;
			if (!(prop in target)) {
				target[prop] = () => proxy; // define lazily
			}
			const val = target[prop];
			if (typeof val === 'function') return (..._args) => proxy;
			return proxy;
		}
	});
	function proxy() { return proxy; }
}

function makeSchema(obj = {}){
	return makeFluent({ ...obj });
}

export const createInsertSchema = (_table, _opts) => makeSchema({ table: _table });
export default { createInsertSchema };
