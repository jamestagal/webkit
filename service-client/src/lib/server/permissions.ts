/**
 * Permissions Matrix for Multi-Tenant Agency System
 *
 * Defines what actions each role can perform.
 * Uses a declarative permissions model for easy auditing and modification.
 *
 * Roles:
 * - owner: Full control, can delete agency, transfer ownership
 * - admin: Most operations, cannot delete agency or manage billing
 * - member: Basic operations on their own data
 */

import { error } from '@sveltejs/kit';
import { getAgencyContext, type AgencyContext } from '$lib/server/agency';
import type { AgencyRole } from '$lib/server/schema';

// =============================================================================
// Permission Definitions
// =============================================================================

/**
 * All available permissions in the system.
 * Format: 'resource:action'
 */
export const PERMISSIONS = {
	// Consultation management
	'consultation:create': ['owner', 'admin', 'member'],
	'consultation:view_own': ['owner', 'admin', 'member'],
	'consultation:view_all': ['owner', 'admin'], // View any consultation in agency
	'consultation:edit_own': ['owner', 'admin', 'member'],
	'consultation:edit_all': ['owner', 'admin'], // Edit any consultation in agency
	'consultation:delete_own': ['owner', 'admin', 'member'],
	'consultation:delete_all': ['owner', 'admin'],

	// Proposal management
	'proposal:create': ['owner', 'admin', 'member'],
	'proposal:view_own': ['owner', 'admin', 'member'],
	'proposal:view_all': ['owner', 'admin'],
	'proposal:edit_own': ['owner', 'admin', 'member'],
	'proposal:edit_all': ['owner', 'admin'],
	'proposal:send': ['owner', 'admin', 'member'],
	'proposal:delete_own': ['owner', 'admin', 'member'],
	'proposal:delete_all': ['owner', 'admin'],

	// Team management
	'member:view': ['owner', 'admin', 'member'], // View member list
	'member:invite': ['owner', 'admin'],
	'member:remove': ['owner', 'admin'],
	'member:change_role': ['owner'], // Only owner can promote/demote

	// Agency settings
	'settings:view': ['owner', 'admin'],
	'settings:edit': ['owner', 'admin'],
	'branding:view': ['owner', 'admin', 'member'],
	'branding:edit': ['owner', 'admin'],
	'form_options:view': ['owner', 'admin', 'member'],
	'form_options:edit': ['owner', 'admin'],

	// Billing & subscription
	'billing:view': ['owner'],
	'billing:manage': ['owner'],
	'subscription:view': ['owner', 'admin'],
	'subscription:manage': ['owner'],

	// Templates
	'template:view': ['owner', 'admin', 'member'],
	'template:create': ['owner', 'admin'],
	'template:edit': ['owner', 'admin'],
	'template:delete': ['owner'],

	// Data export & GDPR
	'data:export': ['owner'],
	'agency:delete': ['owner'],

	// Analytics & reporting
	'analytics:view': ['owner', 'admin'],
	'analytics:export': ['owner', 'admin'],

	// Agency Profile (V2)
	'profile:view': ['owner', 'admin'],
	'profile:edit': ['owner', 'admin'],

	// Packages (V2)
	'packages:view': ['owner', 'admin', 'member'],
	'packages:create': ['owner', 'admin'],
	'packages:edit': ['owner', 'admin'],
	'packages:delete': ['owner'],

	// Add-ons (V2)
	'addons:view': ['owner', 'admin', 'member'],
	'addons:create': ['owner', 'admin'],
	'addons:edit': ['owner', 'admin'],
	'addons:delete': ['owner'],

	// Contract Templates (V2)
	'contract_template:view': ['owner', 'admin'],
	'contract_template:create': ['owner', 'admin'],
	'contract_template:edit': ['owner', 'admin'],
	'contract_template:delete': ['owner'],

	// Contracts (V2)
	'contract:create': ['owner', 'admin', 'member'],
	'contract:view_own': ['owner', 'admin', 'member'],
	'contract:view_all': ['owner', 'admin'],
	'contract:edit_own': ['owner', 'admin', 'member'],
	'contract:edit_all': ['owner', 'admin'],
	'contract:send': ['owner', 'admin', 'member'],
	'contract:delete_own': ['owner', 'admin', 'member'],
	'contract:delete_all': ['owner', 'admin']
} as const;

export type Permission = keyof typeof PERMISSIONS;

// =============================================================================
// Permission Checking Functions
// =============================================================================

/**
 * Check if a role has a specific permission.
 */
export function hasPermission(role: AgencyRole, permission: Permission): boolean {
	const allowedRoles = PERMISSIONS[permission] as readonly string[];
	return allowedRoles.includes(role);
}

/**
 * Check if a role has ALL specified permissions.
 */
export function hasAllPermissions(role: AgencyRole, permissions: Permission[]): boolean {
	return permissions.every((p) => hasPermission(role, p));
}

/**
 * Check if a role has ANY of the specified permissions.
 */
export function hasAnyPermission(role: AgencyRole, permissions: Permission[]): boolean {
	return permissions.some((p) => hasPermission(role, p));
}

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: AgencyRole): Permission[] {
	return (Object.keys(PERMISSIONS) as Permission[]).filter((permission) =>
		hasPermission(role, permission)
	);
}

// =============================================================================
// Permission Guards (for use in remote functions)
// =============================================================================

/**
 * Require a specific permission. Throws 403 if not allowed.
 * Returns the agency context if allowed.
 */
export async function requirePermission(permission: Permission): Promise<AgencyContext> {
	const context = await getAgencyContext();

	if (!hasPermission(context.role, permission)) {
		throw error(403, `Permission denied: ${permission}`);
	}

	return context;
}

/**
 * Require ALL specified permissions. Throws 403 if any is missing.
 */
export async function requireAllPermissions(permissions: Permission[]): Promise<AgencyContext> {
	const context = await getAgencyContext();

	const missing = permissions.filter((p) => !hasPermission(context.role, p));
	if (missing.length > 0) {
		throw error(403, `Permission denied: ${missing.join(', ')}`);
	}

	return context;
}

/**
 * Require ANY of the specified permissions. Throws 403 if none present.
 */
export async function requireAnyPermission(permissions: Permission[]): Promise<AgencyContext> {
	const context = await getAgencyContext();

	if (!hasAnyPermission(context.role, permissions)) {
		throw error(403, `Permission denied. Required one of: ${permissions.join(', ')}`);
	}

	return context;
}

// =============================================================================
// Resource Ownership Helpers
// =============================================================================

/**
 * Check if user can access a resource based on ownership.
 * - If user has 'view_all' permission, they can view any resource
 * - Otherwise, they can only view their own resources
 */
export function canAccessResource(
	role: AgencyRole,
	resourceOwnerId: string,
	currentUserId: string,
	resourceType: 'consultation' | 'proposal' | 'contract'
): boolean {
	// Check for 'view_all' permission
	const viewAllPermission = `${resourceType}:view_all` as Permission;
	if (hasPermission(role, viewAllPermission)) {
		return true;
	}

	// Otherwise, only allow access to own resources
	return resourceOwnerId === currentUserId;
}

/**
 * Check if user can modify a resource based on ownership.
 */
export function canModifyResource(
	role: AgencyRole,
	resourceOwnerId: string,
	currentUserId: string,
	resourceType: 'consultation' | 'proposal' | 'contract'
): boolean {
	// Check for 'edit_all' permission
	const editAllPermission = `${resourceType}:edit_all` as Permission;
	if (hasPermission(role, editAllPermission)) {
		return true;
	}

	// Check for 'edit_own' permission and ownership
	const editOwnPermission = `${resourceType}:edit_own` as Permission;
	if (hasPermission(role, editOwnPermission) && resourceOwnerId === currentUserId) {
		return true;
	}

	return false;
}

/**
 * Check if user can delete a resource based on ownership.
 */
export function canDeleteResource(
	role: AgencyRole,
	resourceOwnerId: string,
	currentUserId: string,
	resourceType: 'consultation' | 'proposal' | 'contract'
): boolean {
	// Check for 'delete_all' permission
	const deleteAllPermission = `${resourceType}:delete_all` as Permission;
	if (hasPermission(role, deleteAllPermission)) {
		return true;
	}

	// Check for 'delete_own' permission and ownership
	const deleteOwnPermission = `${resourceType}:delete_own` as Permission;
	if (hasPermission(role, deleteOwnPermission) && resourceOwnerId === currentUserId) {
		return true;
	}

	return false;
}

// =============================================================================
// Role Hierarchy Helpers
// =============================================================================

const ROLE_HIERARCHY: Record<AgencyRole, number> = {
	owner: 100,
	admin: 50,
	member: 10
};

/**
 * Check if role A is higher than role B in the hierarchy.
 */
export function isRoleHigher(roleA: AgencyRole, roleB: AgencyRole): boolean {
	return ROLE_HIERARCHY[roleA] > ROLE_HIERARCHY[roleB];
}

/**
 * Check if role A is at least as high as role B.
 */
export function isRoleAtLeast(roleA: AgencyRole, roleB: AgencyRole): boolean {
	return ROLE_HIERARCHY[roleA] >= ROLE_HIERARCHY[roleB];
}

/**
 * Get the highest role from a list of roles.
 */
export function getHighestRole(roles: AgencyRole[]): AgencyRole {
	return roles.reduce((highest, role) => (isRoleHigher(role, highest) ? role : highest), 'member');
}

// =============================================================================
// Permission Matrix Display (for admin UI)
// =============================================================================

/**
 * Get a structured permission matrix for display in admin settings.
 */
export function getPermissionMatrix(): {
	category: string;
	permissions: { key: Permission; label: string; owner: boolean; admin: boolean; member: boolean }[];
}[] {
	return [
		{
			category: 'Consultations',
			permissions: [
				formatPermission('consultation:create', 'Create consultations'),
				formatPermission('consultation:view_own', 'View own consultations'),
				formatPermission('consultation:view_all', 'View all consultations'),
				formatPermission('consultation:edit_own', 'Edit own consultations'),
				formatPermission('consultation:edit_all', 'Edit all consultations'),
				formatPermission('consultation:delete_own', 'Delete own consultations'),
				formatPermission('consultation:delete_all', 'Delete all consultations')
			]
		},
		{
			category: 'Proposals',
			permissions: [
				formatPermission('proposal:create', 'Create proposals'),
				formatPermission('proposal:view_own', 'View own proposals'),
				formatPermission('proposal:view_all', 'View all proposals'),
				formatPermission('proposal:edit_own', 'Edit own proposals'),
				formatPermission('proposal:edit_all', 'Edit all proposals'),
				formatPermission('proposal:send', 'Send proposals'),
				formatPermission('proposal:delete_own', 'Delete own proposals'),
				formatPermission('proposal:delete_all', 'Delete all proposals')
			]
		},
		{
			category: 'Team Management',
			permissions: [
				formatPermission('member:view', 'View team members'),
				formatPermission('member:invite', 'Invite members'),
				formatPermission('member:remove', 'Remove members'),
				formatPermission('member:change_role', 'Change member roles')
			]
		},
		{
			category: 'Settings',
			permissions: [
				formatPermission('settings:view', 'View settings'),
				formatPermission('settings:edit', 'Edit settings'),
				formatPermission('branding:view', 'View branding'),
				formatPermission('branding:edit', 'Edit branding'),
				formatPermission('form_options:view', 'View form options'),
				formatPermission('form_options:edit', 'Edit form options')
			]
		},
		{
			category: 'Billing',
			permissions: [
				formatPermission('billing:view', 'View billing'),
				formatPermission('billing:manage', 'Manage billing'),
				formatPermission('subscription:view', 'View subscription'),
				formatPermission('subscription:manage', 'Manage subscription')
			]
		},
		{
			category: 'Templates',
			permissions: [
				formatPermission('template:view', 'View templates'),
				formatPermission('template:create', 'Create templates'),
				formatPermission('template:edit', 'Edit templates'),
				formatPermission('template:delete', 'Delete templates')
			]
		},
		{
			category: 'Data & Compliance',
			permissions: [
				formatPermission('data:export', 'Export agency data'),
				formatPermission('agency:delete', 'Delete agency'),
				formatPermission('analytics:view', 'View analytics'),
				formatPermission('analytics:export', 'Export analytics')
			]
		},
		{
			category: 'Agency Profile',
			permissions: [
				formatPermission('profile:view', 'View agency profile'),
				formatPermission('profile:edit', 'Edit agency profile')
			]
		},
		{
			category: 'Packages',
			permissions: [
				formatPermission('packages:view', 'View packages'),
				formatPermission('packages:create', 'Create packages'),
				formatPermission('packages:edit', 'Edit packages'),
				formatPermission('packages:delete', 'Delete packages')
			]
		},
		{
			category: 'Add-ons',
			permissions: [
				formatPermission('addons:view', 'View add-ons'),
				formatPermission('addons:create', 'Create add-ons'),
				formatPermission('addons:edit', 'Edit add-ons'),
				formatPermission('addons:delete', 'Delete add-ons')
			]
		},
		{
			category: 'Contract Templates',
			permissions: [
				formatPermission('contract_template:view', 'View contract templates'),
				formatPermission('contract_template:create', 'Create contract templates'),
				formatPermission('contract_template:edit', 'Edit contract templates'),
				formatPermission('contract_template:delete', 'Delete contract templates')
			]
		},
		{
			category: 'Contracts',
			permissions: [
				formatPermission('contract:create', 'Create contracts'),
				formatPermission('contract:view_own', 'View own contracts'),
				formatPermission('contract:view_all', 'View all contracts'),
				formatPermission('contract:edit_own', 'Edit own contracts'),
				formatPermission('contract:edit_all', 'Edit all contracts'),
				formatPermission('contract:send', 'Send contracts'),
				formatPermission('contract:delete_own', 'Delete own contracts'),
				formatPermission('contract:delete_all', 'Delete all contracts')
			]
		}
	];
}

function formatPermission(
	key: Permission,
	label: string
): { key: Permission; label: string; owner: boolean; admin: boolean; member: boolean } {
	return {
		key,
		label,
		owner: hasPermission('owner', key),
		admin: hasPermission('admin', key),
		member: hasPermission('member', key)
	};
}
