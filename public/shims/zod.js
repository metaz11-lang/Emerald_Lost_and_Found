// Lightweight shim for zod used only to avoid runtime import errors in the browser.
// Provide z.string().min() and simple chainable APIs used by the client bundle.

function fluent(){
	const handler = {
		get(_t, prop){
			if (prop === 'parse') return (v)=>v;
			if (prop === 'safeParse') return (v)=>({ success:true, data:v });
			if (prop === 'shape') return {};
			return proxy; // any chained property is also callable
		},
		apply(){ return proxy; }
	};
	const proxy = new Proxy(function(){}, handler);
	return proxy;
}

export const z = {
	string: () => fluent(),
	number: () => fluent(),
	boolean: () => fluent(),
	date: () => fluent(),
	object: () => fluent(),
	array: () => fluent(),
	union: () => fluent(),
	literal: () => fluent(),
	enum: () => fluent(),
};

export default { z };
