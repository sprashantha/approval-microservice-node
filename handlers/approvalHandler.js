'use strict'

const
    request = require('request'),
    express = require('express'),
    async = require('async'),
    logger = require('../lib/logger.js'),
    util = require('../lib/util.js');

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
