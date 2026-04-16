export type ModuleStatus = 'complete' | 'running' | 'ready' | 'not_started' | 'partial';

export interface Module {
	id: string;
	label: string;
	icon: string;
	color: string;
	status: ModuleStatus;
	score?: number | null;
	summary: string;
	items: string[];
	href?: string;
	isNew?: boolean;
}

export interface ProgressStep {
	label: string;
	done: boolean;
	active?: boolean;
}

export function alpha(hex: string, pct: number): string {
	return `color-mix(in srgb, ${hex} ${pct}%, transparent)`;
}
