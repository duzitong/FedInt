var MongoClient = require('mongodb').MongoClient
    , Web3 = require('web3')
    , express = require('express')
    , fs = require('fs')
    , assert = require('assert')
    , abi = require('./abi.json');

var url = 'mongodb://localhost:27017/';
var contractAddress = '0x0f2BC94cBC1816B7ccf8F53164A9F45cFF21e44C';
var certPath = 'certs.pem';
var app = express();
var mongoDBConnection, contract;

if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8551"));
}

function uniq(a) {
    return Array.from(new Set(a));
}

function getContract() {
    if (!contract) {
        contract = new web3.eth.Contract(abi, contractAddress);
    }
    return contract;
}

function getMyAddress() {
    return web3.eth.getAccounts().then(function (address) {
        return address[0];
    });
}

function insertAddressIfNotExist(collection, address) {
    return collection.update(
        { 'address': address },
        { $set: { 'address': address } },
        { upsert: true }
    );
}

var setAllCompanies = function (w3, mongo, callback) {
    let collection = mongo.collection('all');
    collection.remove({});
    let cont = getContract();
    cont.methods.lengthOfAllCompanies().call().then(function (result) {
        return Promise.all([...Array(result).keys()].map(function (i) {
            return cont.methods.getCompanyAddress(i).call().then(function (res) {
                return insertAddressIfNotExist(collection, res);
            })
        }))
    }).then(function () {
        callback(mongo);
    });
}

var setApprovedCompanies = function (w3, mongo, callback) {
    let collection = mongo.collection('approved');
    collection.remove({});
    let cont = getContract();
    let calls = []
    calls.push(cont.methods.lengthOfApprovedCompanies().call().then(function (result) {
        if (result > 0) {
            return Promise.all([...Array(result).keys()].map(function (i) {
                return cont.methods.getApprovedCompanyAddress(i).call().then(function (res) {
                    return insertAddressIfNotExist(collection, res);
                })
            }))
        }
    }))
    calls.push(getMyAddress().then(function (address) {
        return cont.methods.getLengthOfTrustedCompanies(address).call().then(function (result) {
            if (result > 0) {
                return Promise.all([...Array(result).keys()].map(function (i) {
                    return cont.methods.getTrustedCompany(address, i).call().then(function (res) {
                        return insertAddressIfNotExist(collection, res);
                    })
                }))
            }
        })
    }))
    Promise.all(calls).then(function () {
        callback(mongo);
    });
}

var updateCertPem = function (docs) {
    let certs = []
    return Promise.all(docs.map(function (doc) {
        return getContract().methods.getCompanyInfo(doc['address']).call().then(function (result) {
            certs.push(result['caCert']);
        })
    })).then(function () {
        fs.writeFile(certPath, certs.join('\n'), function (err) {
            if (err) {
                return console.error(err);
            }
        })
    })
}

var getDocsInCollection = function (db, name, callback) {
    let collection = db.collection(name);
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

    setAllCompanies(web3, database.db("Group"), function (mongo) {
        setApprovedCompanies(web3, database.db("Group"), function (mongo) {
            getDocsInCollection(mongo, 'approved', function (docs) {
                console.log(docs);
                updateCertPem(docs);
            });

            getContract().events.Added()
                .on('data', function (event) {
                    console.log(event);
                })
                .on('changed', function (event) { })
                .on('error', console.error);

            getContract().events.Updated()
                .on('data', function (event) {
                    console.log(event);
                })
                .on('changed', function (event) { })
                .on('error', console.error);

            getContract().events.Approved()
                .on('data', function (event) {
                    console.log(event);
                })
                .on('changed', function (event) { })
                .on('error', console.error);
        })
    });
});

var sendCompanyDetailsByDocs = function (res, docs) {
    let resp = [];
    Promise.all(docs.map(function (doc) {
        return getContract().methods.getCompanyInfo(doc['address']).call().then(function (result) {
            let company = {}
            company['address'] = doc['address'];
            company['name'] = result['name'];
            company['caCert'] = result['caCert'];
            company['homeUrl'] = result['homeUrl'];
            resp.push(company);
        })
    })).then(function () {
        res.send(resp);
    });
}

app.use(function (err, req, res, next) {
    res.status(500).send('Internal Error');
});

app.get('/companies', function (req, res) {
    if (req.query.approved) {
        getDocsInCollection(mongoDBConnection.db('Group'), 'approved', function (docs) {
            sendCompanyDetailsByDocs(res, docs);
        })
    } else if (req.query.dismissed) {
        getDocsInCollection(mongoDBConnection.db('Group'), 'dismiss', function (docs) {
            sendCompanyDetailsByDocs(res, docs);
        });
    } else if (req.query.pending) {
        getDocsInCollection(mongoDBConnection.db('Group'), 'approved', function (approved) {
            getDocsInCollection(mongoDBConnection.db('Group'), 'dismiss', function (dismiss) {
                expctions = uniq((approved.concat(dismiss)).map(function (doc) {
                    return doc.address;
                }));
                mongoDBConnection.db('Group').collection('all').find({ address: { $nin: expctions } }).toArray(function (err, docs) {
                    sendCompanyDetailsByDocs(res, docs);
                });
            });
        });
    } else {
        getDocsInCollection(mongoDBConnection.db('Group'), 'all', function (docs) {
            sendCompanyDetailsByDocs(res, docs);
        })
    }
});

var server = app.listen(8080, function () {

    var host = server.address().address
    var port = server.address().port
    console.log("Listening on " + host + ":" + port);
})

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
