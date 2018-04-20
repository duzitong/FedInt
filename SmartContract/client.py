import time
from web3 import Web3, HTTPProvider
from solc import compile_source
from web3.contract import ConciseContract
from web3.middleware import geth_poa_middleware

contract_addr = '0xB27A2fC06E8048C2b746C62979C56dbcF54F5176'
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

def get_company_info(addr):
    return contract.functions.getCompanyInfo(addr).call()[0]

def approve_company(address):
    func = contract.functions.approveCompany(address)
    func.transact({'from': account, 'gas': func.estimateGas()})
    time.sleep(30)

def get_all_trusted_certs():
    for addr in get_approved_companies():
        print(contract.functions.getCompanyInfo(addr).call()[1])

def update_homeUrl(url):
    func = contract.functions.updateCompanyHomeUrl(url)
    func.transact({'from': account, 'gas': func.estimateGas()})

def update_caCert(cert):
    func = contract.functions.updateCompanyCaCert(cert)
    func.transact({'from': account, 'gas': func.estimateGas()})

cert = '''
-----BEGIN CERTIFICATE-----
MIIEgDCCA2igAwIBAgIJANoSK+kLdYZHMA0GCSqGSIb3DQEBCwUAMIGGMQswCQYD
VQQGEwJVUzETMBEGA1UECBMKQ2FsaWZvcm5pYTERMA8GA1UEBxMIU2FuIGpvc2Ux
DjAMBgNVBAoTBUNpc2NvMQ4wDAYDVQQLEwVDaXNjbzESMBAGA1UEAxMJY2lzY28u
Y29tMRswGQYJKoZIhvcNAQkBFgxjYUBjaXNjby5jb20wHhcNMTgwNDEzMDgyMjMx
WhcNMjEwMTMxMDgyMjMxWjCBhjELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlm
b3JuaWExETAPBgNVBAcTCFNhbiBqb3NlMQ4wDAYDVQQKEwVDaXNjbzEOMAwGA1UE
CxMFQ2lzY28xEjAQBgNVBAMTCWNpc2NvLmNvbTEbMBkGCSqGSIb3DQEJARYMY2FA
Y2lzY28uY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyrE08ZS/
b1lV9zJm0BsgEDH6VcSPZCOLUsyU9/qNJO11sbURpQKkN9tKMin7yoJ6NpOOxXth
z5Tq2cURpXldhd3LMv5/uo7YspB2ZZvaOkZni9Tw+tI8oPaTK0hVvixc9ogFpp4M
bddHZHb4h0nVf3/dSRV4yRIgaokmQZdmNTar+AmsbU3IMaYQiBpST/xrB7ocD/n9
0bypPKGczGuyP95sGeplsj/1X360OxvG/5LyX7jy5e07JYZyc+6D2haiFYz94NSv
DdE2IfGzj4aHkpGhVBJE/Pib59xoriFK/QTLkC4qEAenOVPqUZe7c95aBUW1y190
WZVlv/LjMO149QIDAQABo4HuMIHrMB0GA1UdDgQWBBSU2p4rPCzQEVXnHk5y+TCr
+jpxsjCBuwYDVR0jBIGzMIGwgBSU2p4rPCzQEVXnHk5y+TCr+jpxsqGBjKSBiTCB
hjELMAkGA1UEBhMCVVMxEzARBgNVBAgTCkNhbGlmb3JuaWExETAPBgNVBAcTCFNh
biBqb3NlMQ4wDAYDVQQKEwVDaXNjbzEOMAwGA1UECxMFQ2lzY28xEjAQBgNVBAMT
CWNpc2NvLmNvbTEbMBkGCSqGSIb3DQEJARYMY2FAY2lzY28uY29tggkA2hIr6Qt1
hkcwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAwjvGg6AosloyqvGi
dv4iUwU3fyBg1ZGculm1jPpBautb4OGEzWjTW7l1j5aXdIBsRycrb2gPsA/qST11
fiRLZ3raKSV9O7tnZQV1RPhEMCjnLSk54ALegGeQQqlNJjVLbmG9UDvor0p1C9oc
cKZIF3+T5NHSvD3pjZX2f91NeIqqkOrZwu6r82q6YZ5eYwlD6Rbn0yXaou3eG6Tg
9ucr2o4w+SGxaaDIp1NEtqrbZreyGMrZmQh0bA+hKrr3WqSW+XAHsLEfptGDihe4
hh1Dku32zI8S1SizFoSHi++NhUFkp51BpfE4fB0If7C5mKCToLG32QO30moRfbbE
gViSLg==
-----END CERTIFICATE-----
'''

print(get_approved_companies())

