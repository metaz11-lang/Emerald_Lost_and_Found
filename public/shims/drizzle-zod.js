// Lightweight shim for drizzle-zod used to avoid runtime import errors in the browser.
// Provide chainable schema helpers used by the client bundle: omit, extend, partial, pick.

function makeSchema(obj = {}){
	const s = Object.assign({ __drizzleZodShim: true }, obj);
	s.omit = () => s;
	s.extend = () => s;
	s.partial = () => s;
	s.pick = () => s;
	s.default = () => s;
	return s;
}

export const createInsertSchema = (table) => makeSchema({ table });
export default { createInsertSchema };
