import time
import json
import codecs
from web3 import Web3, HTTPProvider
from web3.middleware import geth_poa_middleware
from solc import compile_source

with open('Group.sol') as f:
    source = f.read()
with open('conf.json') as f:
    conf = json.load(f)

compiled = compile_source(source)
interface = compiled['<stdin>:Group']

w3 = Web3(HTTPProvider('http://127.0.0.1:8551'))
w3.middleware_stack.inject(geth_poa_middleware, layer=0)
contract = w3.eth.contract(abi=interface['abi'], bytecode=interface['bin'])
with open('abi', 'w') as f:
    f.write(json.dumps(interface['abi']))
account = w3.eth.accounts[0]
tx_hash = contract.constructor(conf['name'], open(conf['caCert']).read().strip(), conf['homeUrl']).transact({'from': account, 'gas': 0x47b760})
tx_receipt = None
while(not tx_receipt):
    tx_receipt = w3.eth.getTransactionReceipt(tx_hash)
    time.sleep(1)

contract_address = tx_receipt['contractAddress']
with open('address', 'w') as f:
    print(contract_address)
    f.write(contract_address)

