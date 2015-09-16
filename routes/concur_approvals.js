'use strict'

const 
	request = require('request'),
    express = require('express'),
    json2xml = require('json2xml'),
    xml2js = require('xml2js'),
    logger = require('../lib/logger.js'),
    util = require('../lib/util.js'),
    cache = require('../lib/models/cache.js'),
    handler = require('../handlers/approvalHandler.js'),
    concur = require('concur-platform');


module.exports = function(context, app, router) {
    // Approvals api
    router.get('/expense/v4/approvers/reports', function (req, res) {

        let event = {};
        event.access_token = util.extractToken(req, res);
        event.rootUrl = util.getRootUrl(req, context);
        logger.debug("event:" + event);

        handler.getReportsToApprove(event, context, function(err, data){
            if (err){
                res.status(502).json({error: "bad_gateway", reason: err.code});
                return;
            }
            else{
                res.status(200).json(data);
            }

        });
    });

    router.route('/expense/v4/approvers/reports/:reportID')
        .get(function (req, res) {

            let event = {};
            event.access_token = util.extractToken(req, res);
            event.reportID = req.params.reportID;
            event.rootUrl = util.getRootUrl(req, context);
            logger.debug("event:" + JSON.stringify(event));

            handler.getReportDetails(event, context, function(err, data){
                if (err){
                    res.status(502).json({error: "bad_gateway", reason: err.code});
                    return;
                }
                else{
                    res.status(200).json(data);
                }

            });

        });
    router.route('/expense/v4/approvers/reports/:reportId/workflow')
        .post(function (req, res) {
            let access_token = util.extractToken(req, res);
            let reportId = req.params.reportId;

            let options = {
                method: 'GET',
                url: context.config.concur_api_url + context.config.concur_report_2_0_url + reportId,
                headers: {
                    "Authorization": "OAuth " + access_token,
                    "Accept": "application/json"
                }
            }

            request(options, function (err, getResp, report) {
                if (err) {
                    res.json(502, {error: "bad_gateway", reason: err.code});
                    return;
                }
                let approvalURL, reportJson;
                if (report) {
                    logger.debug("report: " + report.toString());
                    reportJson = JSON.parse(report);
                    approvalURL = reportJson.WorkflowActionURL;
                    logger.debug("approvalURL: " + approvalURL);
                }
                else {
                    logger.debug("Could not retrieve report");
                    res.json(502, {error: "bad_gateway", reason: 'Read report error'});
                    return;
                }

                // Incoming JSON body looks like
//            {
//                    "WorkflowAction": {
//                            "Action": "Approve",
//                            "Comment": "Approved via Concur Connect"
//                    }
//                }
                // Hack to make the xml request work.
                let bodyXml = json2xml(req.body);

                bodyXml = bodyXml.replace("<workflowAction>",
                    "<WorkflowAction xmlns=\"http://www.concursolutions.com/api/expense/expensereport/2011/03\">");
                bodyXml = bodyXml.replace("</workflowAction>",
                    "</WorkflowAction>");
                bodyXml = bodyXml.replace("<comment>",
                    "<Comment>");
                bodyXml = bodyXml.replace("<action>",
                    "<Action>");
                bodyXml = bodyXml.replace("</action>",
                    "</Action>");
                bodyXml = bodyXml.replace("</comment>",
                    "</Comment>");

                logger.debug("bodyJson: " + JSON.stringify(req.body));
                logger.debug("bodyXML: " + bodyXml);

                let options1 = {
                    method: 'POST',
                    url: approvalURL,
                    headers: {
                        "Authorization": "OAuth " + access_token,
                        "Content-Type": "application/xml"
                    },
                    body: bodyXml
                }
                // logger.debug("options1: " + JSON.stringify(options1));
                logger.debug("report.UserLoginID: " + report.UserLoginID);
                logger.debug("report.ReportName: " + report.ReportName);
                logger.debug("report.SubmitDate: " + report.SubmitDate);

                let queueMessage = {
                    type: 'Report',
                    userLoginID: reportJson.UserLoginID,
                    name: reportJson.ReportName,
                    submitDate: reportJson.SubmitDate,
                    options: options1
                };
                if (context.config.use_pubsub == 'true') {
                    logger.debug("queueMessage: " + JSON.stringify(queueMessage));
                    util.publish("Approvals", JSON.stringify(queueMessage), context, function (pubErr) {
                        if (pubErr) {
                            res.json(502, {error: "bad_gateway", reason: pubErr.code});
                        }
                        else {
                            res.status(200).json({"STATUS": "QUEUED FOR APPROVAL"});
                            return;
                        }
                    });
                }
                else if (context.config.use_sqs == 'true') {
                    logger.debug("queueMessage: " + JSON.stringify(queueMessage));
                    cache.clearCache("home", access_token, context);
                    util.sendApprovalSQSMessage(JSON.stringify(queueMessage), context, function (sendErr, data) {
                        if (sendErr) {
                            res.status(502).json({error: "bad_gateway", reason: sendErr.code});
                        }
                        else {
                            res.status(202).json({"STATUS": "QUEUED FOR APPROVAL"});
                            return;
                        }
                    });

                }
                else {
                    request(options1, function (postErr, postResp, approvalResponse) {
                        logger.debug("options1:" + options1.toString());
                        if (postResp) {
                            logger.debug("postResp:" + postResp.toString());
                        }

                        if (postErr) {
                            res.status(502).json({error: "bad_gateway", reason: postErr.code});
                            return;
                        }
                        if (approvalResponse) {
                            let approvalRespString = approvalResponse.toString();
                            logger.debug("request body: " + approvalRespString);
                            if (approvalRespString.indexOf("Error") > 0) {
                                res.status(502).json({error: "bad_gateway", reason: "Malformed request"});
                                return;
                            }
                            else {
                                let parseString = xml2js.parseString;
                                parseString(approvalResponse, function (parseErr, jsonBody) {
                                    if (paseErr) {
                                        res.status(502).json({error: "bad_gateway", reason: parseErr.code});
                                        return;
                                    }
                                    else {
                                        cache.clearCache("home", access_token, context);
                                        logger.debug("response json body " + jsonBody);
                                        res.status(200).json({"STATUS": "SUCCESS"});
                                        return;
                                    }
                                });
                            }
                        }

                    });

                }
            });
        });
}