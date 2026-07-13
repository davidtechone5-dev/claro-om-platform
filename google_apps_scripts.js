/**
 * Claro O&M Platform V2 - Google Apps Script Integration Webhooks
 * 
 * INSTRUCTIONS:
 * 1. Open the Google Sheet linked to the Google Form.
 * 2. Go to Extensions -> Apps Script.
 * 3. Copy the matching function below (or this entire file) into the editor.
 * 4. Save and select the Clock Icon (Triggers) on the left sidebar.
 * 5. Add a Trigger:
 *    - Function: Choose the matching sync function (e.g. syncComplaintForm)
 *    - Deployment: Head
 *    - Event source: From spreadsheet
 *    - Event type: On form submit
 */

// Configuration Options
var CONFIG = {
  // Exposing live Render backend service
  API_BASE_URL: "https://claro-om-platform.onrender.com/api/v1",

  // A secure token that must match the backend's token for authorization
  API_SECRET_TOKEN: "claro_integration_secret_token_12345"
};

/**
 * Trigger function for the COMPLAINT Form Sheet
 */
function syncComplaintForm(e) {
  Logger.log("Received Complaint Form Submit");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = e.range.getRow();

  var data = getRowDataAsJSON(sheet, row, e.values);
  var endpoint = CONFIG.API_BASE_URL + "/sync/complaint";

  sendWebhook(endpoint, data, sheet, row);
}

/**
 * Trigger function for the INITIAL VISIT Form Sheet
 */
function syncInitialVisit(e) {
  Logger.log("Received Initial Visit Form Submit");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = e.range.getRow();

  var data = getRowDataAsJSON(sheet, row, e.values);
  var endpoint = CONFIG.API_BASE_URL + "/sync/visit";

  sendWebhook(endpoint, data, sheet, row);
}

/**
 * Trigger function for the MATERIAL REQUEST Form Sheet
 */
function syncMaterialRequest(e) {
  Logger.log("Received Material Request Form Submit");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = e.range.getRow();

  var data = getRowDataAsJSON(sheet, row, e.values);
  var endpoint = CONFIG.API_BASE_URL + "/sync/material-request";

  sendWebhook(endpoint, data, sheet, row);
}

/**
 * Trigger function for the INSURANCE Form Sheet
 */
function syncInsuranceClaim(e) {
  Logger.log("Received Insurance Form Submit");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = e.range.getRow();

  var data = getRowDataAsJSON(sheet, row, e.values);
  var endpoint = CONFIG.API_BASE_URL + "/sync/insurance";

  sendWebhook(endpoint, data, sheet, row);
}

/**
 * Trigger function for the SERVICE REPORT Form Sheet
 */
function syncServiceReport(e) {
  Logger.log("Received Service Report Form Submit");
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var row = e.range.getRow();

  var data = getRowDataAsJSON(sheet, row, e.values);
  var endpoint = CONFIG.API_BASE_URL + "/sync/service-report";

  sendWebhook(endpoint, data, sheet, row);
}

/**
 * Helper function to extract Google Sheet row data based on Header titles
 */
function getRowDataAsJSON(sheet, row, cellValues) {
  var lastCol = sheet.getLastColumn();
  // Get all header names from row 1
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // Google Sheets onFormSubmit e.values sometimes only contains filled answers.
  // We fetch the row values directly from the sheet to prevent column mismatches.
  var rowValues = sheet.getRange(row, 1, 1, lastCol).getValues()[0];

  var payload = {
    "__row_number": row,
    "__sheet_name": sheet.getName()
  };

  for (var i = 0; i < headers.length; i++) {
    var key = headers[i].toString().trim();
    if (key !== "" && key !== "Sync Status" && key !== "Sync Error") {
      payload[key] = rowValues[i];
    }
  }

  return payload;
}

/**
 * Helper function to post payload to backend API and write response back to Sheet
 */
function sendWebhook(url, payload, sheet, row) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Find column indexes for write-back. (1-indexed for Sheets)
  var syncStatusColIdx = headers.indexOf("Sync Status") + 1;
  var ticketIdColIdx = headers.indexOf("Ticket ID") + 1;
  var syncErrorColIdx = headers.indexOf("Sync Error") + 1;

  // If write-back columns do not exist, create them automatically
  if (syncStatusColIdx === 0) {
    sheet.getRange(1, headers.length + 1).setValue("Sync Status");
    syncStatusColIdx = headers.length + 1;
    headers.push("Sync Status");
  }
  if (ticketIdColIdx === 0) {
    sheet.getRange(1, headers.length + 1).setValue("Ticket ID");
    ticketIdColIdx = headers.length + 1;
    headers.push("Ticket ID");
  }
  if (syncErrorColIdx === 0) {
    sheet.getRange(1, headers.length + 1).setValue("Sync Error");
    syncErrorColIdx = headers.length + 1;
    headers.push("Sync Error");
  }

  // Mark as Syncing
  sheet.getRange(row, syncStatusColIdx).setValue("SYNCING...");
  sheet.getRange(row, syncErrorColIdx).clearContent();

  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "X-Claro-Secret": CONFIG.API_SECRET_TOKEN
    },
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    var responseText = response.getContentText();

    Logger.log("Response Code: " + responseCode);
    Logger.log("Response Body: " + responseText);

    var result = {};
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      result = { "detail": responseText };
    }

    if (responseCode >= 200 && responseCode < 300) {
      sheet.getRange(row, syncStatusColIdx).setValue("SYNCED");
      if (result.ticketNumber) {
        sheet.getRange(row, ticketIdColIdx).setValue(result.ticketNumber);
      }
    } else {
      sheet.getRange(row, syncStatusColIdx).setValue("FAILED");
      sheet.getRange(row, syncErrorColIdx).setValue(result.detail || "Unknown API Error");
    }
  } catch (error) {
    sheet.getRange(row, syncStatusColIdx).setValue("CONNECTION ERROR");
    sheet.getRange(row, syncErrorColIdx).setValue(error.toString());
    Logger.log("Connection Error: " + error.toString());
  }
}

/**
 * Adds a custom menu to the active spreadsheet when opened.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Claro Sync 🔄')
    .addItem('Sync Selected Row', 'syncSelectedRowManually')
    .addSeparator()
    .addItem('Sync Whole Spreadsheet (Pull & Clean Reload)', 'syncAllSheets')
    .addToUi();
}

/**
 * Triggers a full clean database reload from the Google Sheet
 */
function syncSpreadsheetFull() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert('Confirm Full Database Sync',
    'Are you sure you want to run a Full Sync? This will wipe the website database and clean-reload all installations, tickets, visits, and materials directly from this spreadsheet. It will also reflect any deletions. Proceed?',
    ui.ButtonSet.YES_NO);

  if (response !== ui.Button.YES) {
    return;
  }

  ui.showModelessDialog(
    HtmlService.createHtmlOutput("<p style='font-family: sans-serif; color: #111;'>Wiping and clean reloading website database. Please wait...</p>"),
    "Full Database Syncing"
  );

  var url = CONFIG.API_BASE_URL + "/sync/full";
  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "X-Claro-Secret": CONFIG.API_SECRET_TOKEN
    },
    "muteHttpExceptions": true
  };

  try {
    var apiResponse = UrlFetchApp.fetch(url, options);
    var responseCode = apiResponse.getResponseCode();
    var responseBody = apiResponse.getContentText();

    var result = {};
    try {
      result = JSON.parse(responseBody);
    } catch (e) {
      result = { "detail": responseBody };
    }

    if (responseCode >= 200 && responseCode < 300) {
      ui.alert("Full Sync Success!", "Spreadsheet clean-reloaded on the website!\n📍 Installations loaded: " + (result.installationsCount || 0) + "\n📍 Tickets loaded: " + (result.ticketsCount || 0) + "\n\nAny deleted rows in the sheet have been successfully removed from the website registry.", ui.ButtonSet.OK);
    } else {
      ui.alert("Full Sync Failed", result.detail || "Unknown API Error", ui.ButtonSet.OK);
    }
  } catch (error) {
    ui.alert("Connection Error", "Could not connect to the backend server. Make sure ngrok is running and active: " + error.toString(), ui.ButtonSet.OK);
  }
}

/**
 * Manually trigger webhook sync for the currently selected row
 */
function syncSelectedRowManually() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var activeCell = sheet.getActiveCell();
  var row = activeCell.getRow();

  if (row === 1) {
    SpreadsheetApp.getUi().alert("Error: Row 1 contains headers. Please select a data row (row 2 or below) to sync.");
    return;
  }

  var sheetName = sheet.getName().toLowerCase();

  // Identify the matching function to run based on tab name
  var functionToCall;
  if (sheetName.includes("complaint") || sheetName.includes("ticket")) {
    functionToCall = syncComplaintForm;
  } else if (sheetName.includes("visit")) {
    functionToCall = syncInitialVisit;
  } else if (sheetName.includes("material")) {
    functionToCall = syncMaterialRequest;
  } else if (sheetName.includes("insurance")) {
    functionToCall = syncInsuranceClaim;
  } else if (sheetName.includes("service")) {
    functionToCall = syncServiceReport;
  } else {
    SpreadsheetApp.getUi().alert("Error: Sheet tab name must contain 'complaint', 'ticket', 'visit', 'material', 'insurance', or 'service' to map the correct webhook endpoint.");
    return;
  }

  try {
    // Simulate event object 'e' for manual call
    var mockEvent = {
      range: sheet.getRange(row, 1),
      values: sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0]
    };
    functionToCall(mockEvent);
    SpreadsheetApp.getUi().alert("Sync request completed! Check the 'Sync Status' column in your sheet row.");
  } catch (err) {
    SpreadsheetApp.getUi().alert("Sync Failed: " + err.toString());
  }
}

/**
 * Installable trigger function for spreadsheet cell edits
 */
function syncRowOnEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName().toLowerCase();

  // Only sync if the edit occurs on the main Consolidated complaints/tickets sheet
  if (sheetName.includes("complaint") || sheetName.includes("ticket") || sheetName.includes("consolidated")) {
    var row = range.getRow();
    if (row > 1) {
      Logger.log("Automated Edit Sync triggered for row: " + row);
      var data = getRowDataAsJSON(sheet, row);
      var endpoint = CONFIG.API_BASE_URL + "/sync/complaint";
      sendWebhook(endpoint, data, sheet, row);
    }
  }
}

/**
 * Sync all sheets from the Source Spreadsheet to the Destination Spreadsheet,
 * and trigger a clean database reload on the backend website.
 */
function syncAllSheets() {
  var SOURCE_ID = "1Bs2jVPrm0g__cIOg8V80BbGhI6gzqCnw-bYAPissV8s";
  var DESTINATION_ID = "14ZCBnG-TBiS9wYrOe9zRkVJfdKt1vvVhZTZGUi842gw";

  Logger.log("Starting sheet synchronization from Source to Destination...");
  var sourceSS = SpreadsheetApp.openById(SOURCE_ID);
  var destSS = SpreadsheetApp.openById(DESTINATION_ID);

  var sourceSheets = sourceSS.getSheets();

  sourceSheets.forEach(function(sourceSheet) {
    var sheetName = sourceSheet.getName();
    var destSheet = destSS.getSheetByName(sheetName);

    if (!destSheet) {
      destSheet = destSS.insertSheet(sheetName);
    }

    destSheet.clear();

    var range = sourceSheet.getDataRange();
    var values = range.getValues();

    if (values.length && values[0].length) {
      destSheet
        .getRange(1, 1, values.length, values[0].length)
        .setValues(values);
    }
  });

  Logger.log("Sheets sync completed. Triggering live backend database reload...");
  
  var url = CONFIG.API_BASE_URL + "/sync/full";
  var options = {
    "method": "post",
    "contentType": "application/json",
    "headers": {
      "X-Claro-Secret": CONFIG.API_SECRET_TOKEN
    },
    "muteHttpExceptions": true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    Logger.log("Backend response code: " + responseCode);
    Logger.log("Backend response body: " + response.getContentText());
  } catch (error) {
    Logger.log("Failed to sync backend: " + error.toString());
  }
}
