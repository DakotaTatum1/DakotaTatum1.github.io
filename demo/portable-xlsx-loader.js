(function () {
  const decoder = new TextDecoder();
  const parser = new DOMParser();
  const relationshipsNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const cellAddress = (column, row) => `${column}${row}`;
  const columnNumber = (letters) => letters.split("").reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);
  const numberToColumn = (number) => { let value = ""; for (let current = number; current > 0; current = Math.floor((current - 1) / 26)) value = String.fromCharCode(65 + ((current - 1) % 26)) + value; return value; };
  const xml = (bytes) => parser.parseFromString(decoder.decode(bytes), "application/xml");
  const elements = (doc, name) => Array.from(doc.getElementsByTagNameNS("*", name));
  const value = (input) => Number.isFinite(Number(input)) ? Number(input) : 0;
  const text = (input) => input == null ? "" : String(input);

  async function inflate(bytes, method) {
    if (method === 0) return bytes;
    if (method !== 8 || typeof DecompressionStream === "undefined") throw new Error("This browser cannot read the compressed workbook. Open the dashboard in current Edge or Chrome.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function unzip(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer); const view = new DataView(arrayBuffer); let end = -1;
    for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65557); index -= 1) if (view.getUint32(index, true) === 0x06054b50) { end = index; break; }
    if (end < 0) throw new Error("The selected file is not a valid XLSX workbook.");
    const count = view.getUint16(end + 10, true); let cursor = view.getUint32(end + 16, true); const entries = new Map();
    for (let item = 0; item < count; item += 1) {
      if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error("The workbook ZIP directory is invalid.");
      const method = view.getUint16(cursor + 10, true); const compressedSize = view.getUint32(cursor + 20, true); const nameLength = view.getUint16(cursor + 28, true); const extraLength = view.getUint16(cursor + 30, true); const commentLength = view.getUint16(cursor + 32, true); const localOffset = view.getUint32(cursor + 42, true); const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      const localNameLength = view.getUint16(localOffset + 26, true); const localExtraLength = view.getUint16(localOffset + 28, true); const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      entries.set(name, await inflate(bytes.slice(dataStart, dataStart + compressedSize), method)); cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  function readSheet(sheetBytes, sharedStrings) {
    const doc = xml(sheetBytes); const cells = new Map();
    for (const cell of elements(doc, "c")) {
      const address = cell.getAttribute("r"); const type = cell.getAttribute("t"); const raw = elements(cell, "v")[0]?.textContent ?? "";
      const inline = elements(cell, "t").map((node) => node.textContent).join("");
      cells.set(address, type === "s" ? sharedStrings[Number(raw)] : type === "inlineStr" ? inline : type === "str" ? raw : raw === "" ? null : Number(raw));
    }
    return { cells, get(address) { return cells.get(address); }, range(startColumn, startRow, endColumn, endRow) { const output = []; for (let row = startRow; row <= endRow; row += 1) { const values = []; for (let column = columnNumber(startColumn); column <= columnNumber(endColumn); column += 1) values.push(cells.get(cellAddress(numberToColumn(column), row)) ?? null); output.push(values); } return output; } };
  }

  function branch(sheet, controls, exceptions, journal, name, column) {
    const amount = (row) => value(sheet.get(`${column}${row}`)); const revenue = amount(6); const branchExceptions = exceptions.filter((item) => item.branch === name); const controlsPass = controls.filter((item) => item.control.includes(name)).every((item) => item.status === "PASS");
    return { name, revenue, cogs:amount(7), grossProfit:amount(8), grossMargin:revenue ? amount(8) / revenue : null, occupancyExpense:amount(9), utilitiesExpense:amount(10), deliveryExpense:amount(11), netIncome:amount(12), netMargin:revenue ? amount(12) / revenue : null, cash:amount(15), receivables:amount(16), inventory:amount(17), officeEquipment:amount(18), totalAssets:amount(19), accountsPayable:amount(20), loan:amount(21), endingEquity:amount(22), totalLiabilitiesAndEquity:amount(23), balanceSheetDifference:amount(24), operatingExpenses:amount(9)+amount(10)+amount(11), cashReceived:amount(27), openingCash:amount(36), cashPaidForOccupancy:amount(28), cashPaidToSuppliers:amount(29), cashPaidForDelivery:amount(30), netOperatingCash:amount(31), capitalSpending:amount(32), netInvestingCash:amount(33), financingCash:amount(34), netCashChange:amount(35), endingCash:amount(37), cashFlowCheck:amount(38), controlsPass, exceptions:branchExceptions, journal:journal.filter((item) => item.branch === name), inputQualityAction:branchExceptions.length > 1 ? {state:"Training recommended",detail:`${branchExceptions.length} documented exception records. Assign refresher training on source-document matching, duplicate detection, and approval before posting.`} : branchExceptions.length === 1 ? {state:"Targeted review",detail:"One documented exception record. Reinforce source-document matching before posting."} : controlsPass ? {state:"No training action",detail:"No documented exceptions. Current financial controls pass."} : {state:"Control review required",detail:"A financial control requires review before reporting is relied upon."} };
  }

  window.parseDunderMifflinWorkbook = async function (file) {
    const entries = await unzip(await file.arrayBuffer()); const workbook = xml(entries.get("xl/workbook.xml")); const relations = xml(entries.get("xl/_rels/workbook.xml.rels")); const relationMap = new Map(elements(relations, "Relationship").map((item) => [item.getAttribute("Id"), item.getAttribute("Target")]));
    const sharedDoc = entries.get("xl/sharedStrings.xml") ? xml(entries.get("xl/sharedStrings.xml")) : null; const sharedStrings = sharedDoc ? elements(sharedDoc, "si").map((item) => elements(item, "t").map((node) => node.textContent).join("")) : [];
    const sheets = new Map();
    for (const item of elements(workbook, "sheet")) { const id = item.getAttributeNS(relationshipsNs, "id") || item.getAttribute("r:id"); const target = relationMap.get(id); const normalized = target.startsWith("/") ? target.slice(1) : `xl/${target}`; sheets.set(item.getAttribute("name"), readSheet(entries.get(normalized), sharedStrings)); }
    const getSheet = (...names) => names.map((name) => sheets.get(name)).find(Boolean);
    const statements = getSheet("Financial Statements"), controlsSheet = getSheet("Financial Controls"), exceptionsSheet = getSheet("Exception Log", "Exceptions"), ledgerSheet = getSheet("Journal Entries", "Recognized Ledger"), checksSheet = getSheet("Data Checks", "Checks"), readMe = getSheet("Reporting Guide", "ReadMe");
    if (![statements, controlsSheet, exceptionsSheet, ledgerSheet, checksSheet, readMe].every(Boolean)) throw new Error("The workbook does not contain the required reporting sheets.");
    const controls = controlsSheet.range("A",5,"E",200).filter((row) => row[0]).map((row) => ({control:text(row[0]),result:value(row[1]),expected:value(row[2]),status:text(row[3]),purpose:text(row[4])}));
    const exceptions = exceptionsSheet.range("A",5,"H",200).filter((row) => row[0]).map((row) => ({id:text(row[0]),eventId:text(row[1]),branch:text(row[2]),issueType:text(row[3]),evidence:text(row[4]),impact:text(row[5]),treatment:text(row[6]),evidenceIds:text(row[7])}));
    const journal = ledgerSheet.range("A",5,"M",500).filter((row) => row[0]).map((row) => ({entryId:text(row[0]),eventId:text(row[1]),date:text(row[2]),branch:text(row[3]),eventType:text(row[4]),debit:text(row[5]),credit:text(row[6]),amount:value(row[7]),evidenceId:text(row[8]),status:text(row[10]),source:text(row[11]),memo:text(row[12])}));
    const branches = [branch(statements,controls,exceptions,journal,"Scranton","C"),branch(statements,controls,exceptions,journal,"Utica","D"),branch(statements,controls,exceptions,journal,"Nashua","E")]; const total = (field) => branches.reduce((sum,item) => sum + (item[field] || 0),0); const companyRevenue=total("revenue");
    const sourceChecks = checksSheet.range("A",5,"D",200).filter((row) => row[0]).map((row) => ({label:text(row[0]),result:value(row[1]),expected:value(row[2]),notes:text(row[3])}));
    return {meta:{project:"Dunder Mifflin Financial Reporting",reportingCutoff:text(readMe.get("B5")),currency:text(readMe.get("B6")),refreshedAt:new Date().toISOString(),sourceWorkbook:file.name},company:{revenue:companyRevenue,netIncome:total("netIncome"),cash:total("cash"),receivables:total("receivables"),inventory:total("inventory"),totalAssets:total("cash")+total("receivables")+total("inventory")+total("officeEquipment"),grossMargin:companyRevenue ? total("grossProfit")/companyRevenue : null,cashFlow:{openingCash:total("openingCash"),customerReceipts:total("cashReceived"),occupancy:total("cashPaidForOccupancy"),supplierPayments:total("cashPaidToSuppliers"),delivery:total("cashPaidForDelivery"),capitalSpending:total("capitalSpending"),endingCash:total("endingCash")}},branches,paperTrail:{allControlsPass:controls.every((item)=>item.status==="PASS"),controls,exceptions,sourceChecks,recognizedEntries:journal.length}};
  };
})();
