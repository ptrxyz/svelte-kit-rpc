import type { Handle } from '@sveltejs/kit';

import { sequence } from '@sveltejs/kit/hooks';

import { config, routes } from '$lib/rpc/+routes';
import { RPCServer } from '$lib/rpc/server';

const RPC = new RPCServer(config.base);
RPC.registerAll(routes);

const svelteHandler: Handle = async ({ event, resolve }) => {
	if (RPC.isRPCRequest(event)) return await RPC.handle(event);
	return await resolve(event);
};

export const handle: Handle = sequence(svelteHandler);
