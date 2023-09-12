import type { Class, ValidateServiceClass } from './rpccore';
import type { SuperJSONValue } from 'superjson/dist/types';

import superjson from 'superjson';

export class RpcError extends Error {
	constructor(public message: string, public code?: number) {
		super(message);
		// https://www.typescriptlang.org/docs/handbook/2/classes.html#inheriting-built-in-types
		Object.setPrototypeOf(this, RpcError.prototype);
	}
}

interface RpcOptions {
	credentials?: RequestCredentials;
	getHeaders?(): Record<string, string> | Promise<Record<string, string>> | undefined;
}

type Promisify<T> = T extends (...args: unknown[]) => Promise<unknown>
	? T // already a promise
	: T extends (...args: infer A) => infer R
	? (...args: A) => Promise<R>
	: T; // not a function;

export type PromisifyMethods<T extends object> = {
	[K in keyof T]: Promisify<T[K]>;
};

export interface RPCSuccess {
	jsonrpc: '2.0';
	id: string | number | null;
	result: SuperJSONValue;
	meta?: unknown;
}

export interface RPCError {
	error: { code: number; message: string } | string;
}

export type RPCResponse = RPCSuccess | RPCError;

function isRPCError(res: unknown): res is RPCError {
	return (
		typeof res === 'object' &&
		res !== null &&
		'error' in res &&
		((typeof res.error === 'object' &&
			res.error !== null &&
			'code' in res.error &&
			'message' in res.error) ||
			typeof res.error === 'string')
	);
}

function isRPCSuccess(res: unknown): res is RPCSuccess {
	return (
		typeof res === 'object' &&
		res !== null &&
		'jsonrpc' in res &&
		res.jsonrpc === '2.0' &&
		'id' in res &&
		'result' in res
	);
}

function isRPCResponse(res: unknown): res is RPCResponse {
	return isRPCError(res) || isRPCSuccess(res);
}

export function rpcClient<T extends ValidateServiceClass<Class>>(
	url: string | URL,
	options?: RpcOptions
) {
	const request = async (method: string, params: unknown[]) => {
		const id = crypto.randomUUID();
		const headers = options?.getHeaders ? await options.getHeaders() : {};
		const { json: paramJson, meta: paramMeta } = superjson.serialize(removeTrailingUndefs(params));

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				...headers
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				id,
				method,
				params: paramJson,
				meta: paramMeta
			}),
			credentials: options?.credentials,
			redirect: 'follow'
		});

		if (!res.ok) {
			throw new RpcError(res.statusText, res.status);
		}

		const resJson = await res.json().catch(() => undefined);
		if (!isRPCResponse(resJson)) {
			throw new RpcError('Invalid JSON-RPC response.', 500);
		}

		if (isRPCError(resJson)) {
			if (typeof resJson.error === 'string') {
				throw new RpcError(resJson.error, 900);
			} else {
				const { code, message } = resJson.error;
				throw new RpcError(message, code);
			}
		}

		const { result, meta } = resJson;
		if (meta) {
			return superjson.deserialize({ json: result, meta });
		}

		return result;
	};

	return new Proxy(
		{},
		{
			/* istanbul ignore next */
			get(_target, prop, _receiver) {
				if (typeof prop === 'symbol') return;
				if (prop.startsWith('$')) return;
				if (prop in Object.prototype) return;
				if (prop === 'toJSON') return;
				return (...args: unknown[]) => request(prop.toString(), args);
			}
		}
	) as PromisifyMethods<T>;
}

function removeTrailingUndefs(values: unknown[]) {
	const a = [...values];
	while (a.length && a[a.length - 1] === undefined) a.length--;
	return a;
}
