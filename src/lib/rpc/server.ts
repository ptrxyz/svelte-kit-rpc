import type { RequestEvent, ValidateServiceClass } from './rpccore';
import type { Class } from './rpccore';

import { browser } from '$app/environment';
import { base } from '$app/paths';

import { rpcClient } from './client';
import { handleRPC } from './rpccore';

// dirty hack: we can not import service classes on the client, so we can not make
// route definition that contains the actual classes. But we can use have string that named after
// the service class. So on the server, we fill the object with the corresponding classes, on the
// client we simply import the type to get type safety.
export async function createLazyRoute<T extends ValidateServiceClass<Class>>(
	className: string
): Promise<T & Class> {
	if (!browser) {
		const cn = className as keyof typeof import('./+services');
		return (await import('./+services'))[cn] as unknown as T & Class;
	}
	return {} as unknown as T & Class;
}

export function serviceNameToRoute(serviceName: string) {
	return `${base}/rpc/${serviceName}`.toLocaleLowerCase();
}

export function serviceToServiceName(cls: Class) {
	return cls.prototype.constructor.name.replace(/Service$/, '');
}

// RPC Server: this is run on the server and registers + handles all RPC routes.
export class RPCServer {
	private routes = new Map<string, (e: RequestEvent) => ValidateServiceClass<Class>>();

	constructor(private basePath: string = '') {}

	private getHandlerForURL(url: URL) {
		return this.routes.get(url.pathname);
	}

	handle = async (event: RequestEvent) => {
		const handlerFactory = this.getHandlerForURL(event.url);
		if (!handlerFactory) return new Response('Not Found.', { status: 404 });

		try {
			const result = await handleRPC(event, handlerFactory(event));
			for (const [key, value] of result.headers) {
				event.setHeaders({ [key]: value });
			}
			event.setHeaders({ 'x-rpc': 'dfntly' });
			return new Response(result.body, { status: result.status });
		} catch (e) {
			return new Response('Internal Server Error (1).', { status: 500 });
		}
	};

	isRPCRequest = (event: RequestEvent) => {
		return this.getHandlerForURL(event.url) !== undefined;
	};

	register = <T extends ValidateServiceClass<Class> & Class>(cls: T, url: URL | string) => {
		const serviceName = serviceToServiceName(cls);
		const route = typeof url === 'string' ? `${base}${this.basePath}${url}` : url.pathname;
		this.routes.set(route, (event: RequestEvent) => new cls(event));
		console.log(`Registered [${serviceName}]. Route: ${route}`);
	};

	registerAll = <T extends ValidateServiceClass<Class> & Class>(classes: Record<string, T>) => {
		for (const [key, value] of Object.entries(classes)) {
			this.register(value, `/${key}`);
		}
	};
}

export const RPCClient = rpcClient;
