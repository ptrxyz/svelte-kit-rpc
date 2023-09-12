import type { ValidateServiceClass, RequestEvent } from '$lib/rpc/rpccore';

import { RPCRedirect } from '$lib/rpc/rpccore';

// just a simple service showing how to make your own response classes.
// see client.ts for how those are handled.
export class TestService2 implements ValidateServiceClass<TestService2> {
	constructor(private event: RequestEvent) {}

	redir() {
		return new RPCRedirect('/neo/profile', 301);
	}
}
