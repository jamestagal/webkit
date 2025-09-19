export const load: import("./$types").PageServerLoad = async ({ locals }) => {
	return {
		email: locals.user.email,
		avatar: locals.user.avatar,
		subscription_active: locals.user.subscription_active,
	};
};
