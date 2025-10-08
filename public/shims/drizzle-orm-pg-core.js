// Lightweight shim for drizzle-orm/pg-core used only to avoid runtime import errors in the browser.
// It provides chainable, no-op column builders and a pgTable factory so the client bundle
// can call methods like `.primaryKey()`, `.notNull()`, `.unique()`, `.defaultNow()` safely.

function makeColumn(type, name){
  const obj = { __drizzleShim: true, type, name };
  // common chainable methods return the same builder object
  obj.primaryKey = () => obj;
  obj.notNull = () => obj;
  obj.unique = () => obj;
  obj.defaultNow = () => obj;
  obj.default = () => obj;
  obj.nullable = () => obj;
  obj.unsigned = () => obj;
  obj.withLength = () => obj;
  obj.primary = () => obj;
  return obj;
}

export function pgTable(name, cols){
  // Return a simple representation of a table schema
  return { __pgTableShim: true, name, columns: cols };
}

export function serial(name){ return makeColumn('serial', name); }
export function text(name){ return makeColumn('text', name); }
export function integer(name){ return makeColumn('integer', name); }
export function timestamp(name){ return makeColumn('timestamp', name); }
export function boolean(name){ return makeColumn('boolean', name); }

export default {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  boolean,
};
