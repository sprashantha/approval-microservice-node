'use strict'

let should = require('chai').should(),
    expect = require('chai').expect,
    configSetup = require('../lib/config.js'),
    handler = require('../handlers/approvalHandler.js');

let host = 'http://localhost:3000';
let access_token = 'EKL1hRqbSVw3Nd/njDgxl624qPM=';


describe('Get Approvals', function() {

    //let config = configSetup.setupConfig();
    //config.setupMongoConnection = true;
    //let context = {'config': config};
    //let app;
    //
    //before(function() {
    //    app = server.createServer(context);
    //});
    //
    //after(function() {
    //    app.close();
    //});


    it('returns the list of reports to approve', function (done) {
        let event = {};
        event.access_token = access_token;
        event.rootUrl = host;
        let config = configSetup.setupConfig();
        let context = {'config': config};
        handler.getReportsToApprove(event, context, function(err, body){
            body.should.be.an.array;
            if (body.length > 0) {
                body[0].should.have.property('reportID');
                body[0].should.have.property('href');
                body[0].should.have.property('name');
                body[0].should.have.property('total');
            }
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


