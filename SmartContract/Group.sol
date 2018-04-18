pragma solidity ^0.4.18;

contract Group {

    struct Company {
        string name;
        string caCert;
        string homeUrl;
        address[] trustedAddrs;
        uint approval;
    }

    event Added(
        address addr
    );

    event Updated(
        address addr,
        string key,
        string original
    );

    event Approved(
        address addr
    );

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

    function stringEquals(string s1, string s2) internal pure returns (bool) {
        return keccak256(s1) == keccak256(s2);
    }

    function addressArrayContains(address[] addressArray, address addr) internal pure returns (bool) {
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
        Added(msg.sender);
    }

    function updateCompanyCaCert(string cert) public {
        require(addressArrayContains(allCompanyAddrs, msg.sender));

        string memory originalCert = companies[msg.sender].caCert;
        companies[msg.sender].caCert = cert;
        Updated(msg.sender, "caCert", originalCert);
    }

    function updateCompanyHomeUrl(string homeUrl) public {
        require(addressArrayContains(allCompanyAddrs, msg.sender));

        string memory originalUrl = companies[msg.sender].homeUrl;
        companies[msg.sender].homeUrl = homeUrl;
        Updated(msg.sender, "homeUrl", originalUrl);
    }

    function approveCompany(address companyAddr) public {
        require(addressArrayContains(approvedCompanyAddrs, msg.sender) && addressArrayContains(allCompanyAddrs, companyAddr));
        
        companies[msg.sender].trustedAddrs.push(companyAddr);
        companies[companyAddr].approval++;
        if ((companies[companyAddr].approval > approvedCompanyAddrs.length / 2) && !addressArrayContains(approvedCompanyAddrs, companyAddr)) {
            approvedCompanyAddrs.push(companyAddr);
            Approved(companyAddr);
        }
    }

    function lengthOfApprovedCompanies() public view returns(uint) {
        return approvedCompanyAddrs.length;
    }

    function getApprovedCompanyAddress(uint index) public view returns(address) {
        return approvedCompanyAddrs[index];
    }

    function lengthOfAllCompanies() public view returns(uint) {
        return allCompanyAddrs.length;
    }

    function getCompanyAddress(uint index) public view returns(address) {
        return allCompanyAddrs[index];
    }

    function getCompanyInfo(address addr) public view returns(string name, string caCert, string homeUrl) {
        name = companies[addr].name;
        caCert = companies[addr].caCert;
        homeUrl = companies[addr].homeUrl;
    }

    function getLengthOfTrustedCompanies(address addr) public view returns(uint) {
        return companies[addr].trustedAddrs.length;
    }

    function getTrustedCompany(address addr, uint index) public view returns(address) {
        return companies[addr].trustedAddrs[index];
    }
}
