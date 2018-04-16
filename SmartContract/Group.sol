pragma solidity ^0.4.21;

contract Group {

    struct Company {
        string name;
        string caCert;
        string homeUrl;
        address[] trustedAddrs;
        uint approval;
    }

    mapping(address => Company) public companies;
    address[] public allCompanyAddrs;
    address[] public approvedCompanyAddrs;

    function Group(string name, string caCert, string homeUrl) public {
        allCompanyAddrs.push(msg.sender);
        companies[msg.sender] = Company({
            name: name,
            caCert: caCert,
            homeUrl: homeUrl,
            trustedAddrs: new address[](0),
            approval: 1
        });
        approvedCompanyAddrs.push(msg.sender);
    }

    function stringEquals(string s1, string s2) internal returns (bool) {
        return keccak256(s1) == keccak256(s2);
    }

    function addressArrayContains(address[] addressArray, address addr) internal returns (bool) {
        for (uint i = 0; i < addressArray.length; i++) {
            if (addr == addressArray[i]) {
                return true;
            }
        }
        return false;
    }

    function addCompany(string name, string caCert, string homeUrl) public {
        for (uint i = 0; i < allCompanyAddrs.length; i++) {
            if (stringEquals(name, companies[allCompanyAddrs[i]].name)) {
                return;
            }
        }
        
        allCompanyAddrs.push(msg.sender);
        companies[msg.sender] = Company({
            name: name,
            caCert: caCert,
            homeUrl: homeUrl,
            trustedAddrs: new address[](0),
            approval: 0
        });
    }

    function updateCompanyCaCert(string cert) public {
        require(addressArrayContains(allCompanyAddrs, msg.sender));

        companies[msg.sender].caCert = cert;
    }

    function updateCompanyHomeUrl(string homeUrl) public {
        require(addressArrayContains(allCompanyAddrs, msg.sender));

        companies[msg.sender].homeUrl = homeUrl;
    }

    function approveCompany(address companyAddr) public {
        require(addressArrayContains(approvedCompanyAddrs, msg.sender) && addressArrayContains(allCompanyAddrs, companyAddr));
        
        companies[msg.sender].trustedAddrs.push(companyAddr);
        companies[companyAddr].approval++;
        if ((companies[companyAddr].approval > approvedCompanyAddrs.length / 2) && !addressArrayContains(approvedCompanyAddrs, companyAddr)) {
            approvedCompanyAddrs.push(companyAddr);
        }
    }

    function lengthOfApprovedCompanies() public returns(uint) {
        return approvedCompanyAddrs.length;
    }

    function getApprovedCompanyAddress(uint index) public returns(address) {
        return approvedCompanyAddrs[index];
    }

    function lengthOfAllCompanies() public returns(uint) {
        return allCompanyAddrs.length;
    }

    function getCompanyAddress(uint index) public returns(address) {
        return allCompanyAddrs[index];
    }

    function getCompanyInfo(address addr) public returns(string name, string caCert, string homeUrl) {
        name = companies[addr].name;
        caCert = companies[addr].caCert;
        homeUrl = companies[addr].homeUrl;
    }
}