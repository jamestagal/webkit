<script>
	let { onInput, onComplete, isLoading = false } = $props();

	let pinCode = $state(["", "", "", "", "", ""]);

	function checkCompletion() {
		onInput(pinCode.join(""));

		if (pinCode.every((digit) => digit.length === 1)) {
			onComplete(pinCode.join(""));
		}
	}

	function handleInput(index, event) {
		const value = event.target.value.replace(/\D/g, "").slice(-1);
		pinCode[index] = value;
		pinCode = pinCode; // trigger reactivity

		checkCompletion();

		// Handle focus movement
		if (value && index < 5) {
			document.getElementById(`pin-${index + 1}`).focus();
		}
	}

	function handleKeydown(index, event) {
		if (event.key === "Backspace" && !pinCode[index] && index > 0) {
			event.preventDefault();
			pinCode[index - 1] = "";
			document.getElementById(`pin-${index - 1}`).focus();
			checkCompletion();
		}
	}

	function handlePaste(event) {
		event.preventDefault();
		const pastedData = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
		pinCode = pastedData.split("").concat(Array(6 - pastedData.length).fill(""));
		document.getElementById(`pin-${Math.min(pastedData.length, 5)}`).focus();
		checkCompletion();
	}

	export function reset() {
		pinCode = ["", "", "", "", "", ""];
		checkCompletion();
	}
</script>

<div class="grid w-full max-w-md grid-cols-6 gap-2">
	{#each pinCode as digit, i}
		<input
			type="text"
			inputmode="numeric"
			id="pin-{i}"
			bind:value={pinCode[i]}
			oninput={(e) => handleInput(i, e)}
			onkeydown={(e) => handleKeydown(i, e)}
			onpaste={(e) => handlePaste(e)}
			maxlength="1"
			disabled={isLoading}
			autocomplete="off"
			class="!bg-main border-primary-3 focus:outline-secondary-3 aspect-square w-full max-w-16 rounded-xl border text-center
            text-xl {isLoading ? 'bg-primary-2 opacity-50' : ''}"
		/>
	{/each}
</div>

<style>
</style>
