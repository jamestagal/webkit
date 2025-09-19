import type { Toast } from "../types";
import { getContext, setContext } from "svelte";

class ToastState {
	toasts = $state<Toast[]>([]);
	timeoutMap = new Map<symbol, NodeJS.Timeout>();

	showToast(toast: Toast): void {
		setTimeout(() => {
			this.toasts = [...this.toasts, toast];

			const t = setTimeout(() => {
				this.toasts = this.toasts.filter((t) => t.id !== toast.id);
			}, toast.duration);
			this.timeoutMap.set(toast.id, t);
		}, 0);
	}
	removeToast(id: symbol): void {
		this.toasts = this.toasts.filter((t) => t.id !== id);
		const t = this.timeoutMap.get(id);
		if (t) {
			clearTimeout(t);
		}
		this.timeoutMap.delete(id);
	}
	success(title: string, description = ""): void {
		this.showToast({
			id: Symbol(),
			title,
			description,
			type: "success",
			duration: 5000,
		});
	}
	error(title: string, description = ""): void {
		this.showToast({
			id: Symbol(),
			title,
			description,
			type: "error",
			duration: 8000,
		});
	}
	warning(title: string, description = ""): void {
		this.showToast({
			id: Symbol(),
			title,
			description,
			type: "warning",
			duration: 5000,
		});
	}
	info(title: string, description = ""): void {
		this.showToast({
			id: Symbol(),
			title,
			description,
			type: "info",
			duration: 5000,
		});
	}
}

const toastCtx = Symbol("toastCtx");
export function setToast(): ToastState {
	const toastState = new ToastState();
	setContext(toastCtx, toastState);
	return toastState;
}
export function getToast(): ToastState {
	return getContext<ReturnType<typeof getToast>>(toastCtx);
}
