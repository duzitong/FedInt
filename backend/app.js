var MongoClient = require('mongodb').MongoClient
    , Web3 = require('web3')
    , net = require('net')
    , express = require('express')
    , bodyParser = require('body-parser')
    , fs = require('fs')
    , pem = require('pem')
    , assert = require('assert')
    , {execSync} = require('child_process')
    , abi = require('./abi.json');

var url = 'mongodb://localhost:27017/';
var ipc_path = process.env.IPC_PATH;
var contractAddress = '0x1e9677f6aD4d04417D3427Ec0F6652981414e63C';
var certPath = '/usr/local/etc/nginx/ssl/client.pem';
var app = express();
var mongoDBConnection, contract;
var STATUS = {
    APPROVED: 'APPROVED',
    PENDING: 'PENDING',
    NOT_APPLIED: 'NOT_APPLIED'
};

if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    web3 = new Web3(ipc_path, net);
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
        return Promise.all([...Array(Number(result)).keys()].map(function (i) {
            return cont.methods.getCompanyAddress(i).call().then(function (res) {
                return insertAddressIfNotExist(collection, res);
            });
        }));
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
            return Promise.all([...Array(Number(result)).keys()].map(function (i) {
                return cont.methods.getApprovedCompanyAddress(i).call().then(function (res) {
                    return insertAddressIfNotExist(collection, res);
                });
            }));
        }
    }));
    calls.push(getMyAddress().then(function (address) {
        return cont.methods.getLengthOfTrustedCompanies(address).call().then(function (result) {
            if (result > 0) {
                return Promise.all([...Array(Number(result)).keys()].map(function (i) {
                    return cont.methods.getTrustedCompany(address, i).call().then(function (res) {
                        return insertAddressIfNotExist(collection, res);
                    });
                }));
            }
        });
    }));
    Promise.all(calls).then(function () {
        callback(mongo);
    });
}

var updateCertPem = function (docs) {
    let certs = []
    return Promise.all(docs.map(function (doc) {
        return getContract().methods.getCompanyInfo(doc['address']).call().then(function (result) {
            certs.push(result['caCert']);
        });
    })).then(function () {
        fs.writeFile(certPath, certs.join('\n'), function (err) {
            if (err) {
                return console.error(err);
            } else {
                restart = execSync('nginx -s reload');
                console.log('nginx restarted.');
            }
        });
    });
}

var getStatus = function (addr, callback) {
    mongoDBConnection.db('Group').collection('all').findOne({ address: addr }, function (error, doc) {
        if (doc && doc.address) {
            mongoDBConnection.db('Group').collection('approved').findOne({ address: addr }, function (err, doc) {
                if (doc && doc.address) {
                    callback(STATUS.APPROVED);
                } else {
                    callback(STATUS.PENDING);
                }
            });
        } else {
            callback(STATUS.NOT_APPLIED);
        }
    });
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
            getDocsInCollection(mongo, 'all', function (docs) {
                console.log('all');
                console.log(docs);
            });
            getDocsInCollection(mongo, 'approved', function (docs) {
                console.log('approved');
                console.log(docs);
                updateCertPem(docs);
            });

            getContract().events.Added()
                .on('data', function (event) {
                    insertAddressIfNotExist(mongoDBConnection.db('Group').collection('all'), event.returnValues['addr']);
                })
                .on('changed', function (event) { })
                .on('error', console.error);

            getContract().events.Updated()
                .on('data', function (event) {
                    if (event.returnValues['key'] === 'caCert') {
                        getDocsInCollection(mongo, 'approved', function (docs) {
                            updateCertPem(docs);
                        });
                    }
                })
                .on('changed', function (event) { })
                .on('error', console.error);

            // Not Tested
            getContract().events.Approved()
                .on('data', function (event) {
                    insertAddressIfNotExist(mongoDBConnection.db('Group').collection('approved'), event.returnValues['addr']).then(function () {
                        getDocsInCollection(mongo, 'approved', function (docs) {
                            updateCertPem(docs);
                        });
                    });
                })
                .on('changed', function (event) { })
                .on('error', console.error);
        });
    });
});

var sendCompanyDetailsByDocs = function (res, docs, next) {
    let resp = [];
    Promise.all(docs.map(function (doc) {
        return getContract().methods.getCompanyInfo(doc['address']).call().then(function (result) {
            let company = {}
            company['address'] = doc['address'];
            company['name'] = result['name'];
            company['caCert'] = result['caCert'];
            company['homeUrl'] = result['homeUrl'];
            resp.push(company);
        });
    })).then(function () {
        res.send(resp);
    }).catch(next);
}

app.use(bodyParser.json());

app.get('/companies', function (req, res, next) {
    if (req.query.approved) {
        getDocsInCollection(mongoDBConnection.db('Group'), 'approved', function (docs) {
            sendCompanyDetailsByDocs(res, docs, next);
        });
    } else if (req.query.dismissed) {
        getDocsInCollection(mongoDBConnection.db('Group'), 'dismiss', function (docs) {
            sendCompanyDetailsByDocs(res, docs, next);
        });
    } else if (req.query.pending) {
        getDocsInCollection(mongoDBConnection.db('Group'), 'approved', function (approved) {
            getDocsInCollection(mongoDBConnection.db('Group'), 'dismiss', function (dismiss) {
                expctions = uniq((approved.concat(dismiss)).map(function (doc) {
                    return doc.address;
                }));
                mongoDBConnection.db('Group').collection('all').find({ address: { $nin: expctions } }).toArray(function (err, docs) {
                    sendCompanyDetailsByDocs(res, docs, next);
                });
            });
        });
    } else {
        getDocsInCollection(mongoDBConnection.db('Group'), 'all', function (docs) {
            sendCompanyDetailsByDocs(res, docs, next);
        });
    }
});

app.get('/companies/:id', function (req, res, next) {
    getContract().methods.getCompanyInfo(req.params.id).call().then(function (result) {
        let company = {}
        company['address'] = req.params.id;
        company['name'] = result['name'];
        company['caCert'] = result['caCert'];
        company['homeUrl'] = result['homeUrl'];
        res.send(company);
    }).catch(next);
});

app.get('/self', function (req, res, next) {
    getMyAddress().then(function (address) {
        getStatus(address, function (status) {
            if (status === STATUS.NOT_APPLIED) {
                res.send({address, address});
            } else {
                getContract().methods.getCompanyInfo(address).call().then(function (result) {
                    let company = {}
                    company['address'] = address;
                    company['name'] = result['name'];
                    company['caCert'] = result['caCert'];
                    company['homeUrl'] = result['homeUrl'];
                    res.send(company);
                });
            }
        });
    }).catch(next);
})

app.get('/status', function (req, res, next) {
    getMyAddress().then(function (address) {
        getStatus(address, function (status) {
            res.send({ status: status });
        });
    }).catch(next);
});

function setContract(func, message, async, callback) {
    let returned = false;
    getMyAddress().then(function (address) {
        func.estimateGas({ from: address })
            .then(function (gasAmount) {
                console.log(gasAmount);
                func.send({ from: address, gas: gasAmount * 2 })
                    .on('transactionHash', function (hash) {
                        console.log(hash);
                        if (async) {
                            callback({ result: 'Transaction ' + hash + ' Sent' });
                        }
                    })
                    .on('confirmation', function (confirmationNumber, receipt) {
                        console.log(confirmationNumber, receipt);
                        if (!async && !returned) {
                            returned = true;
                            callback({ result: message });
                        }
                    })
                    .on('receipt', function (receipt) {
                        console.log(receipt);
                        if (!async && !returned) {
                            returned = true;
                            callback({ result: message });
                        }
                    })
                    .on('error', function (error, receipt) {
                        console.error(error);
                        console.error(receipt);
                        if (receipt) {
                            callback({ error: 'Gas Not Enough' });
                        } else {
                            callback({ error: 'Failed' });
                        };
                    });
            });
    });
}

app.post('/add', function (req, res, next) {
    getMyAddress().then(function (address) {
        getStatus(address, function (status) {
            if (status === STATUS.NOT_APPLIED) {
                if (req.body && req.body.name && req.body.caCert && req.body.homeUrl) {
                    pem.checkCertificate(req.body.caCert, function (err, valid) {
                        if (valid) {
                            setContract(getContract().methods.addCompany(req.body.name, req.body.caCert, req.body.homeUrl), 'Added', req.body.async, function (resp) {
                                if (resp.result) {
                                    insertAddressIfNotExist(mongoDBConnection.db('Group').collection('all'), req.body.address).then(function () {
                                        res.send(resp);
                                    });
                                } else {
                                    res.status(400).send(resp);
                                }
                            });
                        } else {
                            res.status(400).send({ error: 'Invalid Certificate' })
                        }
                    })
                } else {
                    res.status(400).send('Bad Request');
                }
            } else {
                res.status(403).send('Forbidden');
            }
        });
    }).catch(next);
});

app.post('/update/ca-cert', function (req, res, next) {
    getMyAddress().then(function (address) {
        getStatus(address, function (status) {
            if (status !== STATUS.NOT_APPLIED) {
                if (req.body && req.body.caCert) {
                    if (req.body.caCert) {
                        setContract(getContract().methods.updateCompanyCaCert(req.body.caCert), 'Updated', req.body.async, res.send);
                    }
                } else {
                    res.status(400).send('Bad Request');
                }
            } else {
                res.status(403).send('Forbidden');
            }
        });
    }).catch(next);
});

app.post('/update/home-url', function (req, res, next) {
    getMyAddress().then(function (address) {
        getStatus(address, function (status) {
            if (status !== STATUS.NOT_APPLIED) {
                if (req.body && req.body.homeUrl) {
                    if (req.body.homeUrl) {
                        setContract(getContract().methods.updateCompanyHomeUrl(req.body.homeUrl), 'Updated', req.body.async, res.send);
                    }
                } else {
                    res.status(400).send('Bad Request');
                }
            } else {
                res.status(403).send('Forbidden');
            }
        });
    }).catch(next);
});

app.post('/approve', function (req, res, next) {
    getMyAddress().then(function (address) {
        getStatus(address, function (status) {
            if (status === STATUS.APPROVED) {
                if (req.body && req.body.address) {
                    getStatus(req.body.address, function (status) {
                        if (status === STATUS.PENDING) {
                            setContract(getContract().methods.approveCompany(req.body.address), 'Approved', req.body.async, function (resp) {
                                if (resp.result) {
                                    mongoDBConnection.db('Group').collection('dismiss').deleteOne({ address: req.body.address }, function (error, doc) { });
                                    insertAddressIfNotExist(mongoDBConnection.db('Group').collection('approved'), req.body.address).then(function () {
                                        res.send(resp);
                                    });
                                } else {
                                    res.status(400).send(resp);
                                }
                            });
                        } else {
                            res.status(400).send({ error: 'Invalid Status' });
                        }
                    })
                } else {
                    res.status(400).send('Bad Request');
                }
            } else {
                res.status(403).send('Forbidden');
            }
        });
    }).catch(next);
});

app.post('/dismiss', function (req, res, next) {
    getMyAddress().then(function (address) {
        getStatus(address, function (status) {
            if (status === STATUS.APPROVED) {
                if (req.body && req.body.address) {
                    getStatus(req.body.address, function (status) {
                        if (status === STATUS.PENDING) {
                            insertAddressIfNotExist(mongoDBConnection.db('Group').collection('dismiss'), req.body.address).then(function () {
                                res.send({ retult: 'Dismissed' });
                            })
                        } else {
                            res.status(400).send({ error: 'Invalid Status' });
                        }
                    })
                } else {
                    res.status(400).send('Bad Request');
                }
            } else {
                res.status(403).send('Forbidden');
            }
        });
    }).catch(next);
});

app.use(function (req, res, next) {
    res.status(404).send('Not Found');
});

app.use(function (err, req, res, next) {
    console.error(err);
    res.status(500).send('Internal Error');
});

var server = app.listen(8080, function () {

    var host = server.address().address
    var port = server.address().port
    console.log("Listening on " + host + ":" + port);
})

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
