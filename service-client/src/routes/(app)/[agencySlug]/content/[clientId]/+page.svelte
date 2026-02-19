<script lang="ts">
	import { goto } from "$app/navigation";
	import { page } from "$app/state";

	const agencySlug = page.params.agencySlug;
	const clientId = page.params.clientId;

	goto(`/${agencySlug}/content/${clientId}/pages`, { replaceState: true });
</script>
