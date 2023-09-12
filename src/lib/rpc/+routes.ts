import type * as SVC from './+services';

import { createLazyRoute } from './server';

// this is the base path.
// RPCServer will read this (hooks.server.ts) and register all routes below this path.
// RPCClient will read this (client.ts) and use it for RPC calls.
export const config = {
	base: '/rpc'
};

export const routes = {
	test: await createLazyRoute<SVC.TestService>('TestService'),
	test2: await createLazyRoute<SVC.TestService2>('TestService2')
};
