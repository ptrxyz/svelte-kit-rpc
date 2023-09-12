import type { PromisifyMethods } from './client';

import { base } from '$app/paths';

import { config, routes } from './+routes';
import { rpcClient } from './client';

// rpc is an object that contains all the rpc methods with all the proper paramters/return types
export const rpc: {
	[K in keyof typeof routes]: PromisifyMethods<(typeof routes)[K]>;
} = Object.fromEntries(
	Object.keys(routes).map((uid) => [uid, rpcClient(`${base}${config.base}/${uid}`)])
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
) as any;
