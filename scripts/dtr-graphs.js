/**
 * DTR GRAPHS MODULE
 * Handles the rendering of GitHub-style contribution graphs
 */

function renderDailyGraph(records = dailyRecords) {
    const container = document.getElementById("githubGraph");
    const labelsContainer = document.getElementById("monthLabels");
    const t = (window.DTRI18N && typeof window.DTRI18N.t === "function") ? window.DTRI18N.t : null;
    if (!container) return;

    container.innerHTML = "";
    if (labelsContainer) labelsContainer.innerHTML = "";

    if (!records || records.length === 0) {
        const emptyText = t ? t("no_records_to_visualize") : "No records to visualize.";
        container.innerHTML = `<p class='empty-msg'>${emptyText}</p>`;
        return;
    }

    // Calculate Dynamic Range based strictly on provided records
    const dates = records
        .map(r => parseDateKeyGmt8(toGmt8DateKey(r.date)))
        .filter(Boolean);
    if (!dates.length) {
        const emptyText = t ? t("no_valid_dated_records") : "No valid dated records to visualize.";
        container.innerHTML = `<p class='empty-msg'>${emptyText}</p>`;
        return;
    }
    const today = nowGmt8StartOfDay();
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates, today));
    
    // Align Start to Sunday
    const start = new Date(minDate);
    start.setTime(addDaysGmt8(start, -getGmt8Weekday(start)).getTime());

    // Align End to Saturday of the max week
    const end = new Date(maxDate);
    end.setTime(addDaysGmt8(end, 6 - getGmt8Weekday(end)).getTime());

    const logMap = {};
    records.forEach(r => logMap[r.date] = r);

    const usedMonthNames = new Set();
    let lastCol = -10; 
    let daysIdx = 0;

    for (let d = new Date(start); d <= end; d = addDaysGmt8(d, 1)) {
        const colIndex = Math.floor(daysIdx / 7) + 1;
        const dateStr = toGmt8DateKey(d);
        const record = logMap[dateStr];
        const recordHours = record ? record.hours : 0;
        
        const cell = document.createElement("div");
        cell.className = "day-cell";
        if (record) cell.style.cursor = "pointer";
        
        let level = 0;
        if (recordHours >= 9) level = 3;
        else if (recordHours >= 5) level = 2;
        else if (recordHours > 3) level = 1;

        cell.classList.add(`cell-${['empty', 'low', 'mid', 'high'][level]}`);
        
        // TOOLTIP
        const formattedDate = formatGmt8DateLabel(d, {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric"
        });
        cell.title = `${formattedDate}: ${recordHours}h ${record ? '(Click to view)' : ''}`;

        // CLICKABLE INFO
        cell.onclick = () => {
            if (record) {
                showSummary(record);
                document.getElementById("summary").scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };

        container.appendChild(cell);

        // Align label to the column where the 1st of the month falls
        if (toGmt8DateKey(d).slice(8, 10) === "01") {
            const monthName = formatGmt8DateLabel(d, { month: "short" });
            if (!usedMonthNames.has(monthName) && (colIndex - lastCol) > 2) {
                usedMonthNames.add(monthName);
                lastCol = colIndex;
                if (labelsContainer) {
                    const monthSpan = document.createElement("span");
                    monthSpan.innerText = monthName;
                    monthSpan.style.gridColumnStart = colIndex;
                    labelsContainer.appendChild(monthSpan);
                }
            }
        }
        daysIdx++;
    }
}

function renderWeeklyGraph(records = dailyRecords) {
    const container = document.getElementById("weeklyGraph");
    if (!container) return;
    container.innerHTML = "";

    const weeklyData = {};
    records.forEach(r => {
        const d = parseDateKeyGmt8(toGmt8DateKey(r.date));
        if (!d) return;
        const month = formatGmt8DateLabel(d, { month: "short" });
        const year = formatGmt8DateLabel(d, { year: "numeric" });
        const key = `${month} ${year}`;
        const week = getWeekNumber(d);

        if (!weeklyData[key]) weeklyData[key] = {};
        weeklyData[key][week] = (weeklyData[key][week] || 0) + r.hours;
    });

    const months = Object.keys(weeklyData);
    months.forEach(mKey => {
        const monthBlock = document.createElement("div");
        monthBlock.className = "month-block";

        const nameLabel = document.createElement("div");
        nameLabel.className = "month-name";
        nameLabel.innerText = mKey;
        monthBlock.appendChild(nameLabel);

        const cellsWrapper = document.createElement("div");
        cellsWrapper.className = "week-cells";

        const weeks = weeklyData[mKey];
        Object.values(weeks).forEach(hours => {
            const cell = document.createElement("div");
            cell.className = "day-cell";
            
            let level = 0;
            if (hours >= 40) level = 3;
            else if (hours >= 20) level = 2;
            else if (hours > 0) level = 1;
            
            cell.classList.add(`cell-${['empty', 'low', 'mid', 'high'][level]}`);
            cell.title = `Weekly Total: ${hours}h`;
            cellsWrapper.appendChild(cell);
        });

        monthBlock.appendChild(cellsWrapper);
        container.appendChild(monthBlock);
    });
}
