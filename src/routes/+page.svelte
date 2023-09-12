<script lang="ts">
	import { rpc } from '$lib/rpc/rpc';
	import { onMount } from 'svelte';

	onMount(() => {
		rpc.test.hello('world.').then((res) => {
			console.log(res);
		});

		rpc.test.complex().then((res) => {
			console.log(res);
		});
	});
</script>
