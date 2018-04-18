import time
from web3 import Web3, HTTPProvider
from solc import compile_source
from web3.contract import ConciseContract
from web3.middleware import geth_poa_middleware

contract_addr = '0x0f2BC94cBC1816B7ccf8F53164A9F45cFF21e44C'
with open('Group.sol') as f:
    source = f.read()

compiled = compile_source(source)
interface = compiled['<stdin>:Group']

w3 = Web3(HTTPProvider('http://127.0.0.1:8552'))
w3.middleware_stack.inject(geth_poa_middleware, layer=0)
account = w3.eth.accounts[0]
contract = w3.eth.contract(contract_addr, abi=interface['abi'])

def add_company():
    func = contract.functions.addCompany('apple', open('apple.pem').read().strip(), 'http://localhost:18888')
    func.transact({'from': account, 'gas': func.estimateGas({'from': account})})
    time.sleep(30)

def get_all_companies():
    return [contract.functions.getCompanyAddress(i).call() for i in range(contract.functions.lengthOfAllCompanies().call())]

def get_approved_companies():
    return [contract.functions.getApprovedCompanyAddress(i).call() for i in range(contract.functions.lengthOfApprovedCompanies().call())]

def get_pending_companies():
    return list(set(get_all_companies()) - set(get_approved_companies()))

def get_company_info(address):
    return contract.functions.getCompanyInfo(addr).call()[0]

def approve_company(address):
    func = contract.functions.approveCompany(address)
    func.transact({'from': account, 'gas': func.estimateGas()})
    time.sleep(30)

def get_all_trusted_certs():
    for addr in get_approved_companies():
        print(contract.functions.getCompanyInfo(addr).call()[1])

get_all_trusted_certs()

