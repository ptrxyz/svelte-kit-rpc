import type { ValidateServiceClass, RequestEvent } from '$lib/rpc/rpccore';

// basic service. this class will be instantiated on the server for each request.
// the constructor receives the RequestEvent, so you can access the request headers, body, etc.
export class TestService implements ValidateServiceClass<TestService> {
	constructor(private event: RequestEvent) {}

	hello(name: string) {
		return `Hello ${name}!`;
	}

	complex() {
		return new Set([1, 2, 3]);
	}
}
