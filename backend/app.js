var MongoClient = require('mongodb').MongoClient
    , Web3 = require('web3')
    , express = require('express')
    , assert = require('assert')
    , abi = require('./abi.json');

var url = 'mongodb://localhost:27017/';
var contractAddress = '0xB6E07B738d7fE40d1dcbf40d5cb0cbdD30615b99';
var app = express();
var mongoDBConnection, contract;

if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8551"));
}

var getContract = function () {
    if (!contract) {
        contract = new web3.eth.Contract(abi, contractAddress, {
            from: web3.eth.accounts[0]
        });
    }
    return contract;
}

var setAllServers = function (w3, mongo, callback) {
    var collection = mongo.collection('all');
    collection.remove({});
    let cont = getContract();
    cont.methods.lengthOfAllCompanies().call().then(function (result) {
        var i, inserted = 0;
        for (i = 0; i < result; i++) {
            cont.methods.getCompanyAddress(i).call().then(function (res) {
                collection.insertOne({ 'address': res });
                inserted += 1;
                if (inserted >= result) {
                    callback(mongo);
                }
            })
        }
    });
}

var setApprovedServers = function (w3, mongo, callback) {
    var collection = mongo.collection('approved');
    collection.remove({});
    let cont = getContract();
    cont.methods.lengthOfApprovedCompanies().call().then(function (result) {
        var i, inserted = 0;
        for (i = 0; i < result; i++) {
            cont.methods.getApprovedCompanyAddress(i).call().then(function (res) {
                collection.insertOne({ 'address': res });
                inserted += 1;
                if (inserted >= result) {
                    callback(mongo);
                }
            })
        }
    });
}

var getDocsInCollection = function (db, name, callback) {
    var collection = db.collection(name);
    collection.find({}).toArray(function (err, docs) {
        assert.equal(err, null);
        callback(docs);
    });
}

var shutdown = function () {
    if (server) {
        server.close();
    }
    if (mongoDBConnection) {
        mongoDBConnection.close();
        mongoDBConnection = null;
        console.log('closed...');
    }
    process.exit();
}

// Use connect method to connect to the server
MongoClient.connect(url, function (err, database) {
    assert.equal(null, err);
    mongoDBConnection = database;

    setAllServers(web3, database.db("Group"), function (mongo) {
        setApprovedServers(web3, database.db("Group"), function (mongo) {
            getDocsInCollection(mongo, 'all', function () { });
            getDocsInCollection(mongo, 'approved', function () { });
        })
    });
});

app.use(function (err, req, res, next) {
    res.status(500).send('Internal Error');
});

app.get('/all-companies', function (req, res) {
    getDocsInCollection(mongoDBConnection.db('Group'), 'all', function (docs) {
        var resp = {};
        Promise.all(docs.map(function (doc) {
            return getContract().methods.getCompanyInfo(doc['address']).call().then(function (result) {
                resp[doc['address']] = {}
                resp[doc['address']]['name'] = result['name'];
                resp[doc['address']]['caCert'] = result['caCert'];
                resp[doc['address']]['homeUrl'] = result['homeUrl'];
            })
        })).then(function () {
            res.send(resp);
        });
    })
});

app.get('/approved-companies', function (req, res) {
    getDocsInCollection(mongoDBConnection.db('Group'), 'approved', function (docs) {
        var resp = {};
        Promise.all(docs.map(function (doc) {
            return getContract().methods.getCompanyInfo(doc['address']).call().then(function (result) {
                resp[doc['address']] = {}
                resp[doc['address']]['name'] = result['name'];
                resp[doc['address']]['caCert'] = result['caCert'];
                resp[doc['address']]['homeUrl'] = result['homeUrl'];
            })
        })).then(function () {
            res.send(resp);
        });
    })
});


var server = app.listen(8080, function () {

    var host = server.address().address
    var port = server.address().port
    console.log("Listening on " + host + ":" + port);
})

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
