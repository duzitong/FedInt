from web3 import Web3, HTTPProvider
from solc import compile_source
from web3.contract import ConciseContract
from web3.middleware import geth_poa_middleware

contract_addr = '0x7fbb792a9CD499B6beb3f39f37B299FBF04E11e6'
with open('Group.sol') as f:
    source = f.read()

compiled = compile_source(source)
interface = compiled['<stdin>:Group']

w3 = Web3(HTTPProvider('http://127.0.0.1:8552'))
w3.middleware_stack.inject(geth_poa_middleware, layer=0)
account = w3.eth.accounts[0]
contract = w3.eth.contract(contract_addr, abi=interface['abi'])
for i in range(contract.functions.lengthOfCaCerts().call()):
    print(contract.functions.getCaCert(i).call())

