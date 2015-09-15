var should = require('chai').should(),
    expect = require('chai').expect,
    supertest = require('supertest');

var host = 'http://localhost:3000',
    api = supertest(host);

var access_token = 'EKL1hRqbSVw3Nd/njDgxl624qPM=';


describe('Authentication', function() {

    it('errors if oauth token is missing', function(done) {
        api.get('/expense/v4/approvers/reports')
            .expect(401, done);
    })

    it('errors if oauth token is invalid', function(done) {
        api.get('/expense/v4/approvers/reports')
            .set('Authorization', 'abcdefghijklmnop')
            .expect(401, done);
    })

    it('succeeds if oauth token is valid', function(done) {
        api.get('/expense/v4/approvers/reports')
            .set('Authorization', access_token)
            .expect(200, done);
    })

})


describe('Get Approvals', function() {

    var reportUrl = '';

    it('returns the list of reports to approve', function (done) {
        api.get('/expense/v4/approvers/reports')
            .set('Authorization', access_token)
            .expect(200)
            .end(function (err, res) {
                res.body.should.be.an.array;
                if (res.body.length > 0) {
                    res.body[0].should.have.property('ID');
                    res.body[0].should.have.property('href');
                    res.body[0].should.have.property('name');
                    res.body[0].should.have.property('total');

                    reportUrl = res.body[0]['href'];
                    reportUrl = reportUrl.slice(host.length, reportUrl.length);
                }
                done();
            })
    })


    it('returns the details of a report to approve', function (done) {
        api.get('/expense/v4/approvers/reports/FD9F6475924A4339A31D')
            .set('Authorization', access_token)
            .set('Accept', 'application/json')
            .expect(200)
            .end(function (err, res) {
                res.body.should.exist;
                res.body.should.have.property('reportID');
                res.body.should.have.property('reportName');
                res.body.should.have.property('reportTotal');
                res.body.should.have.property('totalClaimedAmount');
                done();
            })
    })

    it('returns a 404 error if report is not found', function (done) {
        api.get('/expense/v4/approvers/reports/1234')
            .set('Authorization', access_token)
            .expect(404, done);
    })
})


