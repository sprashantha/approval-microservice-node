'use strict'

const
    request = require('request'),
    express = require('express'),
    async = require('async'),
    json2xml = require('json2xml'),
    xml2js = require('xml2js'),
    logger = require('../lib/logger.js'),
    util = require('../lib/util.js'),
    cache = require('../lib//models/cache.js');

function stripOutBlankOrgUnits(jsonBody, n) {
    for (let i = 1; i <= n; i++) {
        let orgUnit = jsonBody['orgUnit' + i];
        if (orgUnit == "") {
            delete jsonBody['orgUnit' + i];
        }
    }
}

function stripOutBlankCustomFields(jsonBody, n) {
    for (let i = 1; i <= n; i++) {
        let custom = jsonBody['custom' + i];
        if (custom && (custom['type'] == null || custom['type'] == "") &&
            (custom['value'] == null || custom['value'] == "") &&
            (custom['code'] == null || custom['code'] == "")) {
            delete jsonBody['custom' + i];
        }
    }
}




exports.getReportsToApprove = function(event, context, callback) {

    let access_token = event.access_token;
    let rootUrl = event.rootUrl;

    let options = {
        method: 'GET',
        url: context.config.concur_api_url + context.config.concur_approvals_url,
        headers: {
            "Authorization": "OAuth " + access_token,
            "Accept": "application/json"
        }
    }
    logger.debug("options.url: " + options.url);
    request(options, function (err, remoteRes, body) {
        if(err){
            callback(err, null);
        }
        else{
            let reports = JSON.parse(body, util.reviver);
            logger.debug("typeof reports: " + typeof reports);
            logger.debug("reports.items.length: " + reports.items.length);
            for (let i = 0; i < reports.items.length; i++) {
                reports.items[i]['reportID'] = reports.items[i]['iD'];
                reports.items[i]['href'] = rootUrl + "/expense/v4/approvers/reports/" + reports.items[i]['reportID'];

                delete reports.items[i]['iD'];
                delete reports.items[i]['uRI'];
            }
            callback(null, reports);
        }
    });
}


exports.getReportDetails = function(event, context, callback) {

    let access_token = event.access_token;
    let rootUrl = event.rootUrl;
    let reportID = event.reportID;

    logger.debug("reportID: " + reportID);

    let options = {
        method: 'GET',
        url: context.config.concur_api_url + context.config.concur_report_2_0_url + reportID,
        headers: {
            "Authorization": "OAuth " + access_token,
            "Accept": "application/json"
        }
    }

    logger.debug("options.url: " + options.url);
    request(options, function (err, remoteRes, body) {
        if (err) {
            callback(err, null);
            return;
        }
        else
        {

            // Note the reviver will change the fields from pascal case to camel case.
            let jsonBody = JSON.parse(body, util.reviver);

            if (!jsonBody || jsonBody == '' || jsonBody.error) {
                logger.debug("body: " + body);

                if (jsonBody && jsonBody.error & jsonBody.error.message == 'Invalid report') {
                    callback({code:404}, {error: "Not found", reason: "Report not found"});
                }
                else if (jsonBody && jsonBody.error & jsonBody.error.message != 'Invalid report') {
                    callback({code:502}, {error: "Bad Gateway", reason: body.error.message});
                }
                else {
                    callback({code:404}, {error: "Not found", reason: "No report body"});
                }
                return;
            }

            // Cleanup the orgunits and custom fields.
            stripOutBlankOrgUnits(jsonBody, 6);
            stripOutBlankCustomFields(jsonBody, 20);
            let expenseEntries = jsonBody['expenseEntriesList'];
            if (expenseEntries){
                for (let i = 0; i < expenseEntries.length; i++) {
                    stripOutBlankOrgUnits(expenseEntries[i], 6);
                    stripOutBlankCustomFields(expenseEntries[i], 40);

                    delete expenseEntries[i]['cardTransaction'];

                    // Generate a URL for the receipt image.
                    if (expenseEntries[i]['entryImageID'] && expenseEntries[i]['entryImageID'] != "") {
                        expenseEntries[i]['receiptImage'] = {
                            href: rootUrl + '/expense/v4/approvers/receiptImage/' + expenseEntries[i]['entryImageID'],
                            rel: "Receipt Image",
                            method: 'GET'
                        }
                    }

                    let itemizations = expenseEntries[i]['itemizationsList'];
                    for (let j = 0; j < itemizations.length; j++) {
                        stripOutBlankOrgUnits(itemizations[j], 6);
                        stripOutBlankCustomFields(itemizations[j], 40);

                        let allocations = itemizations[j]['allocationsList'];
                        for (let k = 0; k < allocations.length; k++) {
                            stripOutBlankOrgUnits(allocations[k], 6);
                            stripOutBlankCustomFields(allocations[k], 40);
                        }
                    }
                }
            }

            delete jsonBody['employeeBankAccount'];
            delete jsonBody['workflowActionURL'];

            jsonBody['workflow'] = {
                href: rootUrl + '/expense/v4/approvers/reports/' + reportID + '/workflow',
                rel: 'Approval or Rejection',
                method: 'POST',
                body: {
                    workflowAction: {
                        action: 'Approve',
                        comment: 'Approved via Connect'
                    }
                }
            }

            // logger.debug("jsonBody: " + JSON.stringify(jsonBody));

            callback(null, jsonBody);
            return;
        }
    });
}
