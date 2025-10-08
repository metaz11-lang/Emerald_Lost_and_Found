// Lightweight shim for zod used only to avoid runtime import errors in the browser.
// Provide z.string().min() and simple chainable APIs used by the client bundle.

const base = {
	string: () => ({
		__zodShim: true,
		min: () => ({ __zodShim: true }),
		max: () => ({ __zodShim: true }),
		optional: () => ({ __zodShim: true }),
		nullable: () => ({ __zodShim: true }),
	}),
	number: () => ({ __zodShim: true }),
	object: (schema) => ({ __zodShim: true, schema }),
	array: (t) => ({ __zodShim: true, of: t }),
};

// Export `z` as an object with helpers so calls like `z.string().min()` work.
export const z = base;
export default { z };
