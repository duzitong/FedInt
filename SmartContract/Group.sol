pragma solidity ^0.4.21;

contract Group {

    struct Company {
        address delegate;
        string name;
        string caCert;
        string homeUrl;
        address[] trustedAddrs;
        uint approval;
        bool approved;
    }

    mapping(address => Company) public companies;
    address[] public companyAddrs;
    string[] public trustedCaCerts;

    function Group(string name, string caCert, string homeUrl) public {
        companyAddrs.push(msg.sender);
        companies[msg.sender] = Company({
            delegate: msg.sender,
            name: name,
            caCert: caCert,
            homeUrl: homeUrl,
            trustedAddrs: new address[](0),
            approval: 1,
            approved: true
        });
        trustedCaCerts.push(caCert);
    }

    function stringEquals(string s1, string s2) internal returns (bool) {
        return keccak256(s1) == keccak256(s2);
    }

    function companyAddrContains(address addr) internal returns (bool) {
        for (uint i = 0; i < companyAddrs.length; i++) {
            if (addr == companyAddrs[i]) {
                return true;
            }
        }
        return false;
    }

    function removeFromTrustedCaCerts(string cert) internal {
        for (uint i = 0; i < trustedCaCerts.length; i++) {
            if (stringEquals(cert, trustedCaCerts[i])) {
                delete trustedCaCerts[i];
            }
        }
    }

    function addCompany(string name, string caCert, string homeUrl) public {
        for (uint i = 0; i < companyAddrs.length; i++) {
            if (stringEquals(name, companies[companyAddrs[i]].name)) {
                return;
            }
        }
        
        companyAddrs.push(msg.sender);
        companies[msg.sender] = Company({
            delegate: msg.sender,
            name: name,
            caCert: caCert,
            homeUrl: homeUrl,
            trustedAddrs: new address[](0),
            approval: 0,
            approved: false
        });
    }

    function updateCompanyCaCert(string cert) public {
        require(companyAddrContains(msg.sender));

        removeFromTrustedCaCerts(companies[msg.sender].caCert);
        companies[msg.sender].caCert = cert;
    }

    function updateCompanyHomeUrl(string homeUrl) public {
        require(companyAddrContains(msg.sender));

        companies[msg.sender].homeUrl = homeUrl;
    }

    function approveCompany(address companyAddr) public {
        require(companyAddrContains(msg.sender) && companyAddrContains(companyAddr));
        
        companies[msg.sender].trustedAddrs.push(companyAddr);
        companies[companyAddr].approval++;
        if ((companies[companyAddr].approval > companyAddrs.length / 2) && !companies[companyAddr].approved) {
            trustedCaCerts.push(companies[companyAddr].caCert);
            companies[companyAddr].approved = true;
        }
    }

    function lengthOfCaCerts() public returns(uint) {
        return trustedCaCerts.length;
    }

    function getCaCert(uint index) public returns(string) {
        return trustedCaCerts[index];
    }

    function getCompanyInfo(address addr) public returns(string name, string caCert, string homeUrl) {
        name = companies[addr].name;
        caCert = companies[addr].caCert;
        homeUrl = companies[addr].homeUrl;
    }
}