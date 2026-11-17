let dashboardData;
let selectedBranch = "Scranton";
let comparisonMetric = "revenue";
let branchSortMetric = "revenue";
let exceptionBranch = "All branches";
let selectedWorkbookHandle = null;
let portableWorkbookInfo = null;
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const shortDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
const metricLabels = { revenue: "Revenue", netIncome: "Net income", cash: "Ending cash", receivables: "Receivables", inventory: "Inventory" };
const portableMode = document.body.dataset.mode === "portable";

const formatMoney = (value) => money.format(value || 0);
const formatStatementMoney = (value) => value < 0 ? `(${formatMoney(Math.abs(value))})` : formatMoney(value);
const formatPct = (value) => value == null ? "—" : pct.format(value);
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[character]);
const bar = (value, max, style = "") => `<div class="bar-track"><div class="water-bar ${style}" style="width:${max ? Math.max(5, Math.round((Math.abs(value) / max) * 100)) : 0}%"></div></div>`;

function setRefreshLabel() {
  const label = document.querySelector("#refresh-label");
  if (portableMode) {
    if (portableWorkbookInfo) {
      const savedAt = shortDate.format(portableWorkbookInfo.lastModified);
      label.textContent = `Excel source: ${portableWorkbookInfo.name} · saved ${savedAt}`;
      return;
    }
    label.textContent = `Included reporting package · cutoff ${dashboardData.meta.reportingCutoff} · choose the source file to enable refresh`;
    return;
  }
  const date = new Date(dashboardData.meta.refreshedAt);
  const source = dashboardData.meta.sourceWorkbook ? ` · ${dashboardData.meta.sourceWorkbook}` : "";
  label.textContent = `Excel refreshed ${shortDate.format(date)}${source}`;
}

function metric(label, value, sub) { return `<article class="metric-card"><div class="label">${label}</div><div class="value">${value}</div><div class="sub">${sub}</div></article>`; }

function renderOverview() {
  const { company, branches, paperTrail, meta } = dashboardData;
  const maxCash = Math.max(company.cashFlow.openingCash, company.cashFlow.customerReceipts, Math.abs(company.cashFlow.supplierPayments), Math.abs(company.cashFlow.capitalSpending), company.cashFlow.endingCash);
  const rankedBranches = [...branches].sort((left, right) => right[comparisonMetric] - left[comparisonMetric]);
  const comparisonMax = Math.max(...rankedBranches.map((branch) => branch[comparisonMetric]));
  const highestReceivables = [...branches].sort((left, right) => right.receivables - left.receivables)[0];
  const highestExpenseRate = [...branches].sort((left, right) => (right.operatingExpenses / right.revenue) - (left.operatingExpenses / left.revenue))[0];
  const trainingBranches = branches.filter((branch) => branch.inputQualityAction.state === "Training recommended" || branch.inputQualityAction.state === "Control review required");
  document.querySelector("#overview-view").innerHTML = `
    <div class="grid metrics">
      ${metric("Company revenue", formatMoney(company.revenue), `Reporting cutoff ${escapeHtml(meta.reportingCutoff)}`)}
      ${metric("Net income", formatMoney(company.netIncome), `${formatPct(company.netIncome / company.revenue)} net margin`)}
      ${metric("Ending cash", formatMoney(company.cash), `${formatMoney(company.cash - company.cashFlow.openingCash)} change from opening`)}
      ${metric("Receivables", formatMoney(company.receivables), "Ending balance; review collection timing" )}
      ${metric("Inventory", formatMoney(company.inventory), "Ending balance across all branches")}
      ${metric("Open exceptions", paperTrail.exceptions.length, paperTrail.allControlsPass ? "All financial controls pass" : "Control review required")}
    </div>
    <div class="status-strip"><span class="status-chip ok">${paperTrail.allControlsPass ? "Financial controls: all pass" : "Financial controls need review"}</span><span class="status-chip">${paperTrail.recognizedEntries} recognized journal entries</span><span class="status-chip">Currency: ${escapeHtml(meta.currency)}</span>${trainingBranches.length ? `<span class="status-chip critical">Input-quality training recommended: ${trainingBranches.map((branch) => branch.name).join(", ")}</span>` : ""}</div>
    <div class="grid overview-grid">
      <article class="panel"><h2>Company cash activity</h2><p class="note">Company totals from the recognized ledger, using the direct method of presenting cash flows.</p><div class="waterfall">
        ${waterRow("Opening cash", company.cashFlow.openingCash, maxCash, "")}
        ${waterRow("Customer collections", company.cashFlow.customerReceipts, maxCash, "")}
        ${waterRow("Occupancy", company.cashFlow.occupancy, maxCash, "outflow")}
        ${waterRow("Supplier payments", company.cashFlow.supplierPayments, maxCash, "outflow")}
        ${waterRow("Capital spending", company.cashFlow.capitalSpending, maxCash, "outflow")}
        ${waterRow("Ending cash", company.cashFlow.endingCash, maxCash, "ending")}
      </div></article>
      <article class="panel"><h2>Company sales, collections, and receivables</h2><p class="note">Company totals at the reporting cutoff. These figures are not added together: revenue is earned, customer receipts are cash received, and receivables are amounts still owed by customers.</p>
        ${revenueCashRow("Revenue", company.revenue, Math.max(company.revenue, company.cashFlow.customerReceipts, company.receivables), "margin-fill")}
        ${revenueCashRow("Customer receipts", company.cashFlow.customerReceipts, Math.max(company.revenue, company.cashFlow.customerReceipts, company.receivables), "cash-fill")}
        ${revenueCashRow("Ending receivables", company.receivables, Math.max(company.revenue, company.cashFlow.customerReceipts, company.receivables), "income-fill")}
      </article>
    </div>
    <div class="grid comparison-grid">
      <article class="panel"><div class="branch-toolbar"><div><h2>Branch comparison: ${metricLabels[comparisonMetric]}</h2><p class="note">Gross margin is 40.0% at each branch, so the more useful differences are sales volume, expenses, cash, and working capital.</p></div><div class="filter-control"><label for="overview-metric">Compare this chart by</label><select id="overview-metric"><option value="revenue">Revenue</option><option value="netIncome">Net income</option><option value="cash">Ending cash</option><option value="receivables">Receivables</option><option value="inventory">Inventory</option></select></div></div><div class="branch-list">
        ${rankedBranches.map((branch) => `<div class="branch-compare"><strong>${branch.name}</strong>${bar(branch[comparisonMetric], comparisonMax, comparisonMetric === "netIncome" ? "income-fill" : comparisonMetric === "cash" ? "cash-fill" : "margin-fill")}<span class="amount">${formatMoney(branch[comparisonMetric])}</span></div>`).join("")}
      </div></article>
      <article class="panel"><h2>Management review priorities</h2><p class="note">The current reporting period highlights these areas for management attention. They do not change the reported financial statements.</p><div class="decision-list">
        <div class="decision-item"><strong>Receivables follow-up: ${highestReceivables.name}</strong><span>${highestReceivables.name} has the highest ending receivables balance at ${formatMoney(highestReceivables.receivables)}. The current source data does not include aging or payment terms.</span></div>
        <div class="decision-item"><strong>Operating-expense review: ${highestExpenseRate.name}</strong><span>${highestExpenseRate.name}'s operating expenses are ${formatPct(highestExpenseRate.operatingExpenses / highestExpenseRate.revenue)} of revenue. Review the supporting transactions before changing operations.</span></div>
        <div class="decision-item"><strong>Reporting checks: ${paperTrail.allControlsPass ? "passed" : "review required"}</strong><span>Open Paper Trail to review the statement checks and the documented exceptions behind this conclusion.</span></div>
      </div></article>
    </div>`;
  const comparisonSelect = document.querySelector("#overview-metric");
  comparisonSelect.value = comparisonMetric;
  comparisonSelect.addEventListener("change", (event) => { comparisonMetric = event.target.value; renderOverview(); });
}

function waterRow(label, value, max, style) { return `<div class="water-row"><span>${label}</span>${bar(value, max, style)}<span class="water-value">${formatMoney(value)}</span></div>`; }
function revenueCashRow(label, value, max, style) { return `<div class="water-row"><span>${label}</span>${bar(value, max, style)}<span class="water-value">${formatMoney(value)}</span></div>`; }
function statementRow(label, value, className = "") { return `<div class="statement-row ${className}"><span>${label}</span><strong>${formatStatementMoney(value)}</strong></div>`; }
function branchStatements(branch) { return `<section class="statement-section"><div class="section-heading"><div><p class="eyebrow">BRANCH FINANCIAL STATEMENTS</p><h2>${branch.name} reporting-period statements</h2></div><p class="note">Amounts update from the selected branch column whenever the dashboard refreshes.</p></div><div class="statement-grid"><article class="panel statement-card"><h3>Income statement</h3><div class="statement-list">${statementRow("Sales revenue", branch.revenue)}${statementRow("Less: Cost of goods sold", -branch.cogs)}${statementRow("Gross profit", branch.grossProfit, "subtotal")}${statementRow("Less: Occupancy expense", -branch.occupancyExpense)}${statementRow("Less: Utilities expense", -branch.utilitiesExpense)}${statementRow("Less: Delivery expense", -branch.deliveryExpense)}${statementRow("Net income", branch.netIncome, "total")}</div></article><article class="panel statement-card"><h3>Balance sheet</h3><div class="statement-list">${statementRow("Cash", branch.cash)}${statementRow("Accounts receivable", branch.receivables)}${statementRow("Inventory", branch.inventory)}${statementRow("Office equipment", branch.officeEquipment)}${statementRow("Total assets", branch.totalAssets, "total")}${statementRow("Accounts payable", branch.accountsPayable)}${statementRow("Loan", branch.loan)}${statementRow("Ending equity", branch.endingEquity)}${statementRow("Total liabilities and equity", branch.totalLiabilitiesAndEquity, "total")}</div><p class="statement-check ${branch.balanceSheetDifference === 0 ? "pass" : "review"}">Balance-sheet check: ${formatStatementMoney(branch.balanceSheetDifference)}</p></article><article class="panel statement-card"><h3>Cash-flow statement</h3><div class="statement-list">${statementRow("Cash received from customers", branch.cashReceived)}${statementRow("Cash paid for occupancy", branch.cashPaidForOccupancy)}${statementRow("Cash paid to suppliers", branch.cashPaidToSuppliers)}${statementRow("Cash paid for delivery", branch.cashPaidForDelivery)}${statementRow("Net cash from operating activities", branch.netOperatingCash, "subtotal")}${statementRow("Capital spending", branch.capitalSpending)}${statementRow("Net cash from investing activities", branch.netInvestingCash, "subtotal")}${statementRow("Cash from financing activities", branch.financingCash)}${statementRow("Net change in cash", branch.netCashChange, "subtotal")}${statementRow("Opening cash", branch.openingCash)}${statementRow("Ending cash", branch.endingCash, "total")}</div><p class="statement-check ${branch.cashFlowCheck === 0 ? "pass" : "review"}">Cash-flow check: ${formatStatementMoney(branch.cashFlowCheck)}</p></article></div></section>`; }
function rankFor(branches, branch, value) { return [...branches].sort((left, right) => value(right) - value(left)).findIndex((item) => item.name === branch.name) + 1; }
function scorecardRow(label, value, context) { return `<div class="scorecard-row"><span>${label}</span><strong>${value}</strong><small>${context}</small></div>`; }
function branchScorecard(branch, branches) {
  const companyRevenue = branches.reduce((sum, item) => sum + item.revenue, 0);
  const expenseRate = branch.revenue ? branch.operatingExpenses / branch.revenue : null;
  const expenseRank = [...branches].sort((left, right) => (left.operatingExpenses / left.revenue) - (right.operatingExpenses / right.revenue)).findIndex((item) => item.name === branch.name) + 1;
  return `<article class="panel branch-scorecard"><div class="scorecard-heading"><div><p class="eyebrow">BRANCH SCORECARD</p><h2>${branch.name} operating and working-capital view</h2></div><p class="note">Focused on measures management can compare and act on.</p></div><div class="scorecard-list">${scorecardRow("Revenue", formatMoney(branch.revenue), `#${rankFor(branches, branch, (item) => item.revenue)} of ${branches.length}; ${formatPct(branch.revenue / companyRevenue)} of company revenue`)}${scorecardRow("Net income", `${formatMoney(branch.netIncome)} (${formatPct(branch.netMargin)})`, `#${rankFor(branches, branch, (item) => item.netIncome)} of ${branches.length} by reported profit`)}${scorecardRow("Operating expenses", `${formatMoney(branch.operatingExpenses)} (${formatPct(expenseRate)})`, `#${expenseRank} of ${branches.length} for lowest operating-expense ratio`)}${scorecardRow("Customer collections", formatMoney(branch.cashReceived), "Cash received from customers in the reporting period")}${scorecardRow("Ending receivables", formatMoney(branch.receivables), `#${rankFor(branches, branch, (item) => item.receivables)} of ${branches.length}; aging detail is not in the source data`)}${scorecardRow("Inventory", formatMoney(branch.inventory), "Ending merchandise balance")}${scorecardRow("Accounts payable", formatMoney(branch.accountsPayable), "Ending supplier balance")}${scorecardRow("Ending cash", formatMoney(branch.endingCash), `${formatMoney(branch.netCashChange)} change from opening cash`)}</div><p class="scorecard-note">Gross margin is 40.0% at every branch. Differences in results are driven by sales volume and operating expenses, not gross-margin differences.</p></article>`;
}
function branchProfileChart(branches, selectedName) {
  const measures = [{ key: "revenue", label: "Revenue" }, { key: "netIncome", label: "Net income" }, { key: "cashReceived", label: "Customer collections" }];
  const colors = { Scranton: "#1f4e78", Utica: "#2f80ed", Nashua: "#c47b00" };
  const width = 660; const height = 255; const left = 64; const right = 34; const top = 30; const bottom = 52; const plotHeight = height - top - bottom; const plotWidth = width - left - right;
  const x = (index) => left + (plotWidth / (measures.length - 1)) * index;
  const scale = (item, measure) => { const maximum = Math.max(...branches.map((branch) => branch[measure.key])); return maximum ? (item[measure.key] / maximum) * 100 : 0; };
  const y = (indexValue) => top + ((100 - indexValue) / 100) * plotHeight;
  return `<article class="panel branch-profile"><div class="profile-heading"><div><p class="eyebrow">BRANCH COMPARISON</p><h2>Operating profile by branch</h2></div><p class="note">Each metric is indexed to its highest branch at 100. This compares branches; it is not a time-series trend.</p></div><svg class="profile-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Indexed comparison of revenue, net income, and customer collections for Scranton, Utica, and Nashua. ${selectedName} is highlighted."><g class="profile-grid">${[0, 50, 100].map((level) => `<line x1="${left}" x2="${width - right}" y1="${y(level)}" y2="${y(level)}"></line><text x="${left - 10}" y="${y(level) + 4}" text-anchor="end">${level}</text>`).join("")}</g>${branches.map((branch) => { const selected = branch.name === selectedName; const points = measures.map((measure, index) => `${x(index)},${y(scale(branch, measure))}`); const path = `M ${points.join(" L ")}`; return `<g class="profile-series ${selected ? "selected" : "dimmed"}"><path d="${path}" stroke="${colors[branch.name] || "#1f4e78"}"></path>${measures.map((measure, index) => `<circle cx="${x(index)}" cy="${y(scale(branch, measure))}" r="${selected ? 6 : 4}" fill="${colors[branch.name] || "#1f4e78"}"><title>${branch.name}: ${measure.label} ${formatMoney(branch[measure.key])}</title></circle>`).join("")}</g>`; }).join("")}${measures.map((measure, index) => `<text class="profile-axis-label" x="${x(index)}" y="${height - 17}" text-anchor="middle">${measure.label}</text>`).join("")}</svg><div class="profile-legend">${branches.map((branch) => `<span class="${branch.name === selectedName ? "selected" : ""}"><i style="background:${colors[branch.name] || "#1f4e78"}"></i>${branch.name}${branch.name === selectedName ? " (selected)" : ""}</span>`).join("")}</div></article>`;
}

function renderBranches() {
  const branch = dashboardData.branches.find((item) => item.name === selectedBranch) || dashboardData.branches[0];
  const sortedBranches = [...dashboardData.branches].sort((left, right) => right[branchSortMetric] - left[branchSortMetric]);
  document.querySelector("#branches-view").innerHTML = `<div class="branches-layout">
    <div><div class="branch-toolbar"><span class="section-label">Rank branch cards by</span><select id="branch-sort"><option value="revenue">Revenue</option><option value="netIncome">Net income</option><option value="cash">Ending cash</option><option value="receivables">Receivables</option></select></div><div class="branch-tabs">${sortedBranches.map((item) => `<button class="branch-tab ${item.name === branch.name ? "active" : ""}" data-branch="${item.name}"><strong>${item.name}</strong><div class="tab-meta"><span>${formatMoney(item[branchSortMetric])} ${metricLabels[branchSortMetric].toLowerCase()}</span><span>${escapeHtml(item.inputQualityAction.state)}</span></div></button>`).join("")}</div></div>
    <div><article class="panel"><div class="branch-header"><div><p class="eyebrow">BRANCH EXPLORER</p><h2>${branch.name}</h2><p class="note">${branch.controlsPass ? "Financial controls pass for this branch." : "A financial control requires review."}</p></div><div class="action-callout ${branch.inputQualityAction.state === "No training action" ? "ok" : "warn"}"><strong>Input-quality action: ${escapeHtml(branch.inputQualityAction.state)}</strong><small>${escapeHtml(branch.inputQualityAction.detail)}</small></div></div></article>
    ${branchScorecard(branch, dashboardData.branches)}
    ${branchProfileChart(dashboardData.branches, branch.name)}
    ${branchStatements(branch)}
    <div class="split-panel"><article class="panel"><h2>Recognized evidence trail</h2><p class="note">Journal entries directly supporting this branch’s reported activity.</p>${journalTable(branch.journal)}</article><article class="panel"><h2>Exceptions and recorded treatment</h2><p class="note">Document issues are retained and explained without entering unsupported activity.</p>${exceptionsCards(branch.exceptions)}</article></div></div>
  </div>`;
  document.querySelector("#branch-sort").value = branchSortMetric;
  document.querySelector("#branch-sort").addEventListener("change", (event) => { branchSortMetric = event.target.value; renderBranches(); });
  document.querySelectorAll(".branch-tab").forEach((button) => button.addEventListener("click", () => { selectedBranch = button.dataset.branch; renderBranches(); }));
}

function journalTable(rows) { if (!rows.length) return `<p class="empty">No recognized entries found.</p>`; return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Entry</th><th>Event</th><th>Debit</th><th>Credit</th><th>Amount</th><th>Evidence</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.entryId)}</td><td>${escapeHtml(row.eventType)}</td><td>${escapeHtml(row.debit)}</td><td>${escapeHtml(row.credit)}</td><td class="num">${formatMoney(row.amount)}</td><td><span class="tag">${escapeHtml(row.evidenceId)}</span></td></tr>`).join("")}</tbody></table></div>`; }
function exceptionsCards(rows) { if (!rows.length) return `<p class="empty">No exception records for this branch.</p>`; return rows.map((row) => `<article class="exception-card"><h3>${escapeHtml(row.issueType)}</h3><p><strong>Effect if mishandled:</strong> ${escapeHtml(row.impact)}</p><p><strong>Recorded treatment:</strong> ${escapeHtml(row.treatment)}</p></article>`).join(""); }

function renderTrail() {
  const { paperTrail } = dashboardData;
  const summary = Object.fromEntries(paperTrail.sourceChecks.map((item) => [item.label, item.result]));
  const filteredExceptions = exceptionBranch === "All branches" ? paperTrail.exceptions : paperTrail.exceptions.filter((exception) => exception.branch === exceptionBranch);
  document.querySelector("#trail-view").innerHTML = `<div class="trail-readout ${paperTrail.allControlsPass ? "pass" : "review"}"><strong>${paperTrail.allControlsPass ? "Financial reporting checks passed" : "Financial reporting checks need review"}</strong><span>${paperTrail.allControlsPass ? "The balance sheets balance and ending cash agrees between the cash-flow statements and balance sheets." : "At least one reconciliation did not meet the required result. Review the control table before using the statements."}</span></div><div class="grid trail-summary">
    ${trailItem("Accounting entries used", summary["Recognized journal rows"], "Journal entries included in the financial statements")}${trailItem("Supporting documents", summary["Evidence records"], "Evidence records linked to reported activity")}${trailItem("Earlier versions retained", summary["Superseded evidence records"], "Replaced documents kept for the audit trail")}${trailItem("Duplicates excluded", summary["Duplicate evidence records"], "Duplicate documents prevented from posting twice")}${trailItem("Items kept out of reporting", summary["Not-recognized evidence records"], "Unsupported or prospective items not included in results")}</div>
    <div class="split-panel"><article class="panel"><h2>Financial-statement checks</h2><p class="note">These checks confirm that the reported statements reconcile. A pass means the current difference is the required $0.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>What we checked</th><th>Current difference</th><th>Required difference</th><th>Outcome</th></tr></thead><tbody>${paperTrail.controls.map((control) => `<tr><td>${escapeHtml(plainControlLabel(control.control))}</td><td class="num">${formatStatementMoney(control.result)}</td><td class="num">${formatStatementMoney(control.expected)}</td><td class="${control.status === "PASS" ? "pass" : "review"}">${control.status === "PASS" ? "Pass" : "Review"}</td></tr>`).join("")}</tbody></table></div></article>
    <article class="panel"><div class="branch-toolbar"><div><h2>Exception radar</h2><p class="note">Corrections, duplicates, and non-recognized items stay visible so their treatment can be reviewed.</p></div><select id="exception-filter" class="trail-filter"><option>All branches</option><option>Scranton</option><option>Utica</option><option>Nashua</option></select></div>${filteredExceptions.length ? filteredExceptions.map((row) => `<article class="exception-card"><h3>${escapeHtml(row.branch)} · ${escapeHtml(row.issueType)}</h3><p>${escapeHtml(row.evidence)}</p><p><strong>Potential effect:</strong> ${escapeHtml(row.impact)}</p><p><strong>Treatment:</strong> ${escapeHtml(row.treatment)}</p></article>`).join("") : `<p class="empty">No exceptions match this branch filter.</p>`}</article></div>`;
  document.querySelector("#exception-filter").value = exceptionBranch;
  document.querySelector("#exception-filter").addEventListener("change", (event) => { exceptionBranch = event.target.value; renderTrail(); });
}

function plainControlLabel(label) { if (label.startsWith("Balance-sheet equation difference — ")) return `${label.replace("Balance-sheet equation difference — ", "")} balance sheet balances`; if (label.startsWith("Cash-flow ending cash less balance-sheet cash — ")) return `${label.replace("Cash-flow ending cash less balance-sheet cash — ", "")} cash flow agrees with balance sheet`; return label; }
function trailItem(label, value, detail) { return `<article class="trail-item"><span class="section-label">${label}</span><strong>${value ?? "—"}</strong><small>${detail}</small></article>`; }

function renderAll() { renderOverview(); renderBranches(); renderTrail(); setRefreshLabel(); }
function switchView(view) { document.querySelectorAll(".view").forEach((element) => element.classList.toggle("active", element.id === `${view}-view`)); document.querySelectorAll(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.view === view)); document.querySelector("#page-title").textContent = ({ overview: "Company overview", branches: "Branch explorer", trail: "Reporting evidence and checks" })[view]; }
async function loadData() { if (portableMode) { if (window.embeddedDashboardData) { dashboardData = window.embeddedDashboardData; renderAll(); return; } document.querySelector("#overview-view").innerHTML = `<article class="panel"><h2>Dashboard data unavailable</h2><p class="note">Keep portable.html and portable-data.js together in the dashboard folder. You can also select the checked workbook to load it manually.</p></article>`; return; } const response = await fetch("/api/data", { cache: "no-store" }); if (!response.ok) throw new Error("The dashboard data could not be loaded."); dashboardData = await response.json(); renderAll(); }
document.querySelectorAll(".nav-button").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.view)));

async function loadPortableWorkbook(file, button) {
  button.disabled = true;
  button.textContent = "Refreshing…";
  try {
    dashboardData = await window.parseDunderMifflinWorkbook(file);
    portableWorkbookInfo = { name: file.name, lastModified: new Date(file.lastModified) };
    renderAll();
  } catch (error) {
    document.querySelector("#refresh-label").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Refresh from Excel";
  }
}

async function selectPortableWorkbook() {
  const workbookPicker = document.querySelector("#workbook-picker");
  const refreshButton = document.querySelector("#refresh-button");
  if ("showOpenFilePicker" in window) {
    try {
      [selectedWorkbookHandle] = await window.showOpenFilePicker({ multiple: false, types: [{ description: "Excel workbooks", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }] });
      await loadPortableWorkbook(await selectedWorkbookHandle.getFile(), refreshButton);
    } catch (error) {
      if (error.name !== "AbortError") document.querySelector("#refresh-label").textContent = error.message;
    }
    return;
  }
  if (!workbookPicker) return;
  workbookPicker.value = "";
  document.querySelector("#refresh-label").textContent = "Choose the saved dashboard source workbook to connect it.";
  workbookPicker.click();
}

const refreshButton = document.querySelector("#refresh-button");
const selectWorkbookButton = document.querySelector("#select-workbook-button");
const workbookPicker = document.querySelector("#workbook-picker");
if (selectWorkbookButton) selectWorkbookButton.addEventListener("click", () => { if (portableMode) selectPortableWorkbook(); else refreshButton?.click(); });
if (refreshButton) refreshButton.addEventListener("click", async () => { const button = refreshButton; if (portableMode) { if (!selectedWorkbookHandle) return selectPortableWorkbook(); const latestFile = await selectedWorkbookHandle.getFile(); if (portableWorkbookInfo && latestFile.lastModified < portableWorkbookInfo.lastModified.getTime()) { document.querySelector("#refresh-label").textContent = `The selected file is older than the version already loaded. Choose the current dashboard source workbook again.`; selectedWorkbookHandle = null; button.textContent = "Choose File"; return; } return loadPortableWorkbook(latestFile, button); } button.disabled = true; button.textContent = "Refreshing…"; try { const response = await fetch("/api/refresh", { method: "POST" }); if (!response.ok) throw new Error("Excel refresh failed."); dashboardData = await response.json(); renderAll(); } catch (error) { document.querySelector("#refresh-label").textContent = error.message; } finally { button.disabled = false; button.textContent = "Refresh from Excel"; } });
if (portableMode && workbookPicker) workbookPicker.addEventListener("change", async (event) => { const file = event.target.files[0]; if (!file) return; selectedWorkbookHandle = null; event.target.value = ""; await loadPortableWorkbook(file, refreshButton); });
loadData().catch((error) => { document.querySelector("#overview-view").innerHTML = `<article class="panel"><h2>Dashboard data unavailable</h2><p class="note">${escapeHtml(error.message)}</p></article>`; document.querySelector("#overview-view").classList.add("active"); });
