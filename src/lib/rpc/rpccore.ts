import type { RPCResponse } from './client';
import type * as Kit from '@sveltejs/kit';

import superjson from 'superjson';

interface JsonRpcRequest {
	jsonrpc: '2.0';
	id?: string | number | null;
	method: string;
	params: unknown[];
	meta?: unknown;
}

// SuperJSONValue should be this:
type JSONValue =
	| string
	| number
	| boolean
	| null
	| void
	| { [x: string]: JSONValue }
	| Array<JSONValue>
	| undefined
	| bigint
	| symbol
	| Date
	| RegExp
	| Set<JSONValue>
	| Map<JSONValue, JSONValue>
	| Error;
// | URL

export type RequestEvent = Kit.RequestEvent;

export interface Class {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	new (...args: any[]): any;
}

type allowedReturnVals = JSONValue | Promise<JSONValue> | RPCRedirect;
type Methods<T> = keyof T; // Exclude<keyof T, 'headers'>

export type ValidateServiceClass<
	T extends { [K in Methods<T>]: ((...args: never[]) => unknown) | unknown }
> = {
	[K in Methods<T>]: T[K] extends JSONValue
		? T[K]
		: T[K] extends (...args: never[]) => unknown
		? Parameters<T[K]>[number] extends JSONValue
			? ReturnType<T[K]> extends allowedReturnVals // JSONValue | Promise<JSONValue>
				? T[K]
				: allowedReturnVals
			: allowedReturnVals
		: allowedReturnVals;
};

export class RPCRedirect {
	constructor(
		public location: string | URL,
		public status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308
	) {}
}

function hasProperty<T, P extends string>(obj: T, prop: P): obj is T & Record<P, unknown> {
	return typeof obj === 'object' && obj !== null && prop in obj;
}

function isJsonRpcRequest(req: unknown): req is JsonRpcRequest {
	if (!hasProperty(req, 'jsonrpc') || req.jsonrpc !== '2.0') return false;
	if (!hasProperty(req, 'method') || typeof req.method !== 'string') return false;
	if (!hasProperty(req, 'params') || !Array.isArray(req.params)) return false;
	return true;
}

function hasMethod<T, P extends string>(
	obj: T,
	prop: P
): obj is T & Record<P, (...params: unknown[]) => unknown> {
	return hasProperty(obj, prop) && typeof obj[prop] === 'function';
}

function getRequestId(req: unknown) {
	if (hasProperty(req, 'id')) {
		const id = req.id;
		if (typeof id === 'string' || typeof id === 'number') return id;
	}
	return null;
}

function respond(
	payload: RPCResponse | null,
	status = 200,
	headers: HeadersInit | undefined = undefined
) {
	try {
		if (payload) {
			const data = superjson.serialize(payload);
			if (!data || !data.json) throw new Error("Can't serialize payload.");
			return new Response(JSON.stringify(data.json), { headers, status });
		} else {
			return new Response(null, { headers, status });
		}
	} catch (e) {
		if (hasProperty(e, 'message') && typeof e.message === 'string') {
			return new Response(e.message, { status: 500 });
		} else {
			return new Response('Internal Server Error (2).', { status: 500 });
		}
	}
}

function fail(message: string, status: number, code = 0) {
	if (code > 0) return respond({ error: { code, message } }, status);
	return respond({ error: message }, status);
}

function redirect(
	location: string | URL,
	status: 300 | 301 | 302 | 303 | 304 | 305 | 306 | 307 | 308
) {
	return respond(null, status, { Location: location.toString() });
}

// Main function to handle a RPC request.
export async function handleRPC<T extends { [K in Methods<T>]: (...args: never[]) => unknown }>(
	args: RequestEvent,
	srvc: T
) {
	const safeParse = (text: string) => {
		try {
			return JSON.parse(text);
		} catch (e) {
			return null;
		}
	};

	const rawBodyText = await args.request.text();
	const rawBodyJSON = safeParse(rawBodyText);
	const id = getRequestId(rawBodyJSON) || crypto.randomUUID();

	if (!isJsonRpcRequest(rawBodyJSON)) {
		return fail('Invalid JSON-RPC request.', 400);
	}

	const { jsonrpc, method } = rawBodyJSON;
	if (!hasMethod(srvc, method)) {
		return fail(`Method ${method} not found.`, 404);
	}

	const { meta, params: rawParams } = rawBodyJSON;
	const params = superjson.deserialize<unknown[]>({ json: rawParams, meta } as ReturnType<
		typeof superjson.serialize
	>);

	try {
		const result = await srvc[method](...params);
		if (result instanceof RPCRedirect) {
			return redirect(result.location, result.status);
		}
		const { json, meta } = superjson.serialize(result);
		return respond({ jsonrpc, id, result: json, meta }, 200);
	} catch (e) {
		console.log(e);
		throw e;
	}
}
