export const load: import("./$types").LayoutServerLoad = ({ locals }) => {
	return {
		access: locals.user.access,
		subscription_active: locals.user.subscription_active,
	};
};
