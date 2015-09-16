'use strict'

let should = require('chai').should(),
    expect = require('chai').expect,
    logger = require('../lib/logger.js'),
    configSetup = require('../lib/config.js'),
    handler = require('../handlers/approvalHandler.js');

let host = 'http://localhost:3000';
let access_token = 'EKL1hRqbSVw3Nd/njDgxl624qPM=';


describe('Get Approvals', function() {

    let reportID = "";
    let context = {};

    before(function(){
        let config = configSetup.setupConfig();
        context = {'config': config};

        // Change the logging level so that we don't see too many debug logs.
        logger.transports.console.level = 'error';
    })

    it('returns the list of reports to approve', function (done) {

        let event = {};
        event.access_token = access_token;
        event.rootUrl = host;

        handler.getReportsToApprove(event, context, function(err, body){
            body.items.should.be.an.array;
            body.items[0].should.have.property('reportID');
            body.items[0].should.have.property('href');
            body.items[0].should.have.property('name');
            body.items[0].should.have.property('total');

            reportID = body.items[0]['reportID'];
            done();
        });
    });

    it('returns the details of a report to approve', function (done) {

        let event = {};
        event.access_token = access_token;
        event.rootUrl = host;
        event.reportID = reportID;
        logger.info("reportID: " + reportID);

        handler.getReportDetails(event, context, function(err, body){
            body.should.exist;
            body.should.have.property('reportID');
            body.should.have.property('reportName');
            body.should.have.property('reportTotal');
            done();
        });
    });

    it('returns a 404 error if report is not found', function (done) {

        let event = {};
        event.access_token = access_token;
        event.rootUrl = host;
        event.reportID = 12345;

        handler.getReportDetails(event, context, function(err, body){
            err.code.should.equal(404);
            done();
        });
    });

    //it('returns a 404 error if report is not found', function (done) {
    //    api.get('/expense/v4/approvers/reports/1234')
    //        .set('Authorization', access_token)
    //        .expect(404, done);
    //
    //});
    //
    //
    //it('returns the details of a report to approve', function (done) {
    //    // api.get('/expense/v4/approvers/reports/FD9F6475924A4339A31D')
    //    api.get(reportUrl)
    //        .set('Authorization', access_token)
    //        .set('Accept', 'application/json')
    //        .expect(200)
    //        .end(function (err, res) {
    //            res.body.should.exist;
    //            res.body.should.have.property('reportID');
    //            res.body.should.have.property('reportName');
    //            res.body.should.have.property('reportTotal');
    //            res.body.should.have.property('totalClaimedAmount');
    //        })
    //    done();
    //
    //});

});


