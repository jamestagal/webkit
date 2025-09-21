<script>
  import dayjs from 'dayjs';
  import isToday from 'dayjs/plugin/isToday';
  import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
  import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
  import localeData from 'dayjs/plugin/localeData';

  dayjs.extend(isToday); 
  dayjs.extend(isSameOrBefore);
  dayjs.extend(isSameOrAfter);
  dayjs.extend(localeData);

  import ChevronRight from '@icons/chevron-right.svelte';
  import ChevronLeft from '@icons/chevron-left.svelte';
  import { fly } from 'svelte/transition';

  // All date objects in logic are dayjs instances for consistency

  let {
    isLoading = false,
    currentDate = $bindable(dayjs().format('YYYY-MM-DD')),
    currentMonth = $bindable(dayjs().format('YYYY-MM')),
    minDate, // Format: YYYY-MM-DD (2025-01-01)
    maxDate, // Format: YYYY-MM-DD (2025-12-31)
    mode = 'single', // single, range, multiple
    allowedDates = $bindable(),
    excludedDates = $bindable(),
    allowPreviousMonth = $bindable(true),
    allowNextMonth = $bindable(true),
    selectedDates = $bindable([]),
    selectedRange = $bindable([]),
    warningDates = $bindable([]),
    allowSelectYear = false,
    allowSelectMonth = false,
    allowRangeOverUnavailable = $bindable(false),
    allowRangeOverExcluded = $bindable(false),
    allowRangeSingleDay = $bindable(false),
    onDateChange = () => {},
    onMonthChange = () => {}
  } = $props();

  let transitionDirection = $state(0);
  let touchStartX = 0, touchEndX = 0;
  let hoverDate = $state(null);

  let year = $state(dayjs(currentDate || dayjs()).format('YYYY'));
  let selectedMonth = $state(dayjs(currentDate || dayjs()).format('M'));
  const month = $derived(dayjs(currentMonth));
  const monthName = $derived(month.format('MMMM'));
  const firstDay = $derived(month.startOf('month').day());
  const minDay = $derived(minDate ? dayjs(minDate) : null);
  const maxDay = $derived(maxDate ? dayjs(maxDate) : null);
  const prevMonth = $derived(month.subtract(1, 'month'));
  const nextMonth = $derived(month.add(1, 'month'));
  const isPrevMonthValid = $derived(allowPreviousMonth && (!minDay || prevMonth.isSameOrAfter(minDay.startOf('month'), 'month')));
  const isNextMonthValid = $derived(allowNextMonth && (!maxDay || nextMonth.isSameOrBefore(maxDay.startOf('month'), 'month')));
  const noAvailableDates = $derived.by(() => {
    if (isLoading) return false;
    if (Array.isArray(allowedDates)) return allowedDates.length === 0;
    return false;
  });

  const firstDayOfWeek = $derived(dayjs.localeData().firstDayOfWeek()); // 0=Sunday, 1=Monday, etc. based on locale
  const weekdays = $derived(dayjs.weekdaysShort(true));
  const formatDate = date => date.format('YYYY-MM-DD');


  function isDateDisabled(date) {
    const str = formatDate(date);
    if (isLoading) return true;
    if (minDay && date.isBefore(minDay, 'day') && !allowedDates) return true;
    if (maxDay && date.isAfter(maxDay, 'day') && !allowedDates) return true;
    if (!date.isSame(month, 'month')) return true;
    if (excludedDates && excludedDates.includes(str)) return true;
    if (mode === 'range' && selectedDates.length === 1 && date.isBefore(dayjs(selectedDates[0]))) return true;
    if (Array.isArray(allowedDates) && !allowedDates.includes(str)) return true;
    return false;
  }

  function generateDateRange(start, end) {
    if(start === end) return [start, end];

    let lastValid = getLastValidInRange(start, end);
    let range = [];
    let cur = dayjs(start);
    let last = dayjs(lastValid);
    while (cur.isSameOrBefore(last, 'day')) {
      range.push(formatDate(cur));
      cur = cur.add(1, 'day');
    }
    return range;
  }

  async function selectDate(str) {
    const date = dayjs(str);
    if (isDateDisabled(date)) return;


    if(mode === 'single') {
      selectedDates = [str];
    }
    
    if(mode === 'multiple') {
      if(selectedDates.includes(str)) {
        selectedDates = selectedDates.filter(d => d !== str);
      } else {
        selectedDates = [...selectedDates, str];
      }
    }
    
    if(mode === 'range') {

      if((selectedDates.includes(str) && !allowRangeSingleDay) || selectedRange.length >= 2) {
        selectedDates = [];
        selectedRange = [];
      } else {
        selectedDates = [...selectedDates, str];
        selectedRange = selectedDates;
      }


      if(selectedRange.length >= 2) {
          if(dayjs(getLastValidInRange(selectedDates[0], str)).isBefore(dayjs(str))) {
            selectedDates = [];
            selectedRange = [];
          } else {
            selectedRange = [selectedDates[0], str];
            selectedDates = generateDateRange(selectedRange[0], selectedRange[1]);
          }
        }
    }

    onDateChange({ dates: selectedDates, range: selectedRange.length === 2 && mode === 'range' ? selectedRange : null });
  }

  function checkInRange(str) {
    if (mode === 'range' && selectedDates.length > 0) {
      let start = dayjs(selectedDates[0]);
      let end = dayjs(selectedRange[1] || hoverDate);
      let lastValid = getLastValidInRange(start, end);
      return dayjs(str).isAfter(start) && dayjs(str).isSameOrBefore(dayjs(lastValid));
    }
    return false;
  }

  function changeMonth(delta) {
    if ((delta < 0 && isPrevMonthValid) || (delta > 0 && isNextMonthValid)) {
      transitionDirection = delta;
      const newMonth = month.add(delta, 'month');
      currentMonth = newMonth.format('YYYY-MM');
      currentDate = currentMonth + '-01';
      year = newMonth.format('YYYY');
      selectedMonth = newMonth.format('M');
      onMonthChange({ date: currentMonth });
    }
  }

  function handleSwipe(e) {
    let diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && isNextMonthValid && !isLoading) changeMonth(1);
      else if (diff < 0 && isPrevMonthValid && !isLoading) changeMonth(-1);
    }
  }

  function getDays() {
    let firstOfMonth = month.startOf('month');
    // Calculate how many days to subtract to reach the first cell (locale-aware)
    let diff = (firstOfMonth.day() - firstDayOfWeek + 7) % 7;
    let start = firstOfMonth.subtract(diff, 'day');
    let days = [];
    for (let i = 0; i < 42; i++) { // 6 weeks * 7 days
      days.push(start.add(i, 'day'));
    }
    return days;
  }

  function getLastValidInRange(start, end) {
    let cur = dayjs(start);
    let last = dayjs(end);
    let lastValid = cur;
    while (cur.isSameOrBefore(last, 'day')) {
      let str = formatDate(cur);

      // Excluded dates take priority
      if (excludedDates && excludedDates.includes(str)) {
        if (!allowRangeOverExcluded) break;
      }
      // Unavailable dates (not in allowedDates)
      else if (allowedDates && !allowedDates.includes(str)) {
        if (!allowRangeOverUnavailable) break;
      } else {
        lastValid = cur;
      }
      cur = cur.add(1, 'day');
    }
    return formatDate(lastValid);
  }

  const dateStyle = 'p-2 aspect-square rounded-md text-sm font-semibold flex items-center justify-center cursor-pointer';

</script>

<div class="flex flex-col w-full text-sm max-w-sm mx-auto h-full font-normal"
  ontouchstart={e => touchStartX = e.touches[0].clientX}
  ontouchend={e => { touchEndX = e.changedTouches[0].clientX; handleSwipe(e); }}>
  
  <div class="flex flex-row w-full justify-between items-center mb-6">
    <button 
    aria-label="Previous Month"
    onclick={() => changeMonth(-1)} 
    class="{dateStyle} { !isPrevMonthValid ? 'opacity-20 pointer-events-none' : '' }" 
    disabled={!isPrevMonthValid || isLoading}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left-icon lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg>
    </button>
    <div class="flex flex-row items-center gap-2 text-lg font-semibold capitalize">
          {#if allowSelectMonth}
              <select bind:value={selectedMonth} class="capitalize" onchange={(e) => {
                currentMonth = dayjs(`${year}-${e.target.value}`);
                currentDate = currentMonth;
              }}>
              {#each Array.from({length: 12}, (_, i) => i + 1) as m}
                  <option value={String(m)}>{dayjs().month(m - 1).format('MMMM')}</option>
              {/each}
           </select>
         {:else}
          <div class="flex flex-row gap-2">
              {monthName}
          </div>
        {/if}
        {#if allowSelectYear}
          <select bind:value={year} onchange={() => {
             currentMonth = dayjs(`${year}-${selectedMonth.padStart(2, '0')}`).format('YYYY-MM');
             currentDate = currentMonth;
           }}>
              {#each Array.from({length: 200}, (_, i) => i + 1900) as y}
                  <option value={String(y)}>{y}</option>
              {/each}
          </select>
        {:else}
          <div class="flex flex-row gap-2">
              {year}
          </div>
        {/if}
    </div>
    <button 
    aria-label="Next Month"
    onclick={() => changeMonth(1)} 
    class="{dateStyle} { !isNextMonthValid ? 'opacity-20 pointer-events-none' : '' }" 
    disabled={!isNextMonthValid || isLoading}>
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
    </button>
  </div>
  <div class="grid grid-cols-7 text-center font-medium text-secondary-4 mb-4">
    {#each weekdays as d}
      <div>{d}</div>
    {/each}
  </div>
  <div class="grid grid-cols-1 grid-rows-1 w-full overflow-hidden">
    {#key currentDate}
      <div
        class="w-full col-start-1 row-start-1 relative"
        in:fly="{{ x: transitionDirection * 200, duration: 400 }}"
        out:fly="{{ x: transitionDirection * -200, duration: 200 }}"
      >

          {#if noAvailableDates}
            <div class="absolute bg-main text-nowrap border border-primary-3 rounded-xl shadow-xl p-4 flex top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
                No available dates this month
            </div>
          {/if}
          <div class="grid grid-cols-7 gap-1 text-center place-items-center justify-items-center">
            {#each getDays() as date (date.format('YYYY-MM-DD'))}
              {@const str = date.format('YYYY-MM-DD')}
              {@const isCurrent = date.isToday()}
              {@const isDisabled = isDateDisabled(date)}
              {@const isSelected = selectedDates.includes(str)}
              {@const isInRange = checkInRange(str)}
              <button
                disabled={isDisabled}
                onclick={() => selectDate(str)}
                onmouseover={() => hoverDate = str}
                onfocus={() => hoverDate = str}
                class="{dateStyle} relative w-full max-w-12 border border-transparent hover:border-secondary transition-all duration-100 
                  {isLoading && 'animate-pulse'}
                  {isDisabled ? 'pointer-events-none text-primary-4' : ''}
                  {(isSelected && !isInRange) || (selectedRange.includes(str)) ? 'bg-secondary text-primary' : ''}
                  {(isInRange && !selectedRange.includes(str)) ? 'bg-primary-3 text-secondary-4' : ''}">
                {date.date()}
                {#if isCurrent}
                  <span class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full {isSelected ? 'bg-primary' : 'bg-secondary'}"></span>
                {/if}
                {#if warningDates.includes(str)}
                  <span class="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-warning"></span>
                {/if}
              </button>
            {/each}
          </div>
      </div>
    {/key}
  </div>
</div>


<!-- @component Calendar
### Usage
```svelte
<script>
  import Calendar from '$lib/components/ui/Calendar.svelte';

  // EVERYTHING BELOW IS OPTIONAL
  // import dayjs from 'dayjs';
  // import 'dayjs/locale/de'; // Import the locale
  // dayjs.locale('de'); // Set the locale
  let mode = 'range'; // Selection mode: 'single', 'range' or 'multiple'
  let minDate = '2025-01-01'; // Minimum allowed date
  let maxDate = '2025-12-31'; // Maximum allowed date
  let allowedDates = ['2025-05-23']; // Dates that are available - undefined/null means all dates are available
  let excludedDates = ['2025-05-26']; // Dates that are excluded
  let warningDates = ['2025-05-27']; // Dates that are warning
  let allowRangeOverUnavailable = true; // Allow range over unavailable dates (like weekends)
  let allowRangeOverExcluded = false; // Allow range over excluded dates (from excludedDates)
  let allowRangeSingleDay = false; // Allow range to be a single day (Allow range to start and end on the same day)
  function onDateChange(e) { // Callback when a date is selected
    console.log(e); // returns { dates: [date1, date2], range: [date1, date2] } - range is only returned if at least 2 dates are selected
  }
  function onMonthChange(e) { // Callback when a month is selected
    console.log(e);
  }
</script>

<Calendar 
{mode}
{minDate}
{maxDate}
{allowedDates}
{excludedDates}
{warningDates}
{allowRangeOverUnavailable}
{allowRangeOverExcluded}
{allowRangeSingleDay}
onDateChange={onDateChange}
onMonthChange={onMonthChange} />
```
### Dependencies
```terminal
npm install dayjs
```
 -->