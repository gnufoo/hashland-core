const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("HashLand", function () {

  var theNFT;
  var deployer, tester1, tester2;
  var pool;

  it("NFT Deploy", async function () {
    const NFTContract = await ethers.getContractFactory("MiningNFT");
    const NFTPool = await ethers.getContractFactory("StakingPool");
    [deployer, tester1, tester2] = await ethers.getSigners();

    theNFT = await NFTContract.connect(deployer).deploy();
    pool = await NFTPool.connect(deployer).deploy(theNFT.address);

    await theNFT.deployed();
    await pool.deployed();

    await theNFT.mint(tester1.address, 1);

    expect(await theNFT.balanceOf(tester1.address)).to.equal("1");
    expect(await theNFT.ownerOf(1)).to.equal(tester1.address);

  });

  it("NFT Upgrade", async function() {
    await theNFT.mint(tester1.address, 1);
    await theNFT.mint(tester1.address, 1);
    await theNFT.mint(tester1.address, 1);

    const tokenIds = [1, 2, 3, 4];
    expect(await theNFT.balanceOf(tester1.address)).to.equal("4");
    await theNFT.connect(tester1).upgrade(tokenIds);

    expect(await theNFT.tokenLevel(5)).to.equal(2);
    expect(await theNFT.balanceOf(tester1.address)).to.equal("1");
  });

  it("NFT Mining", async function(){
    await theNFT.connect(tester1).setApprovalForAll(pool.address, true);
    await pool.connect(tester1).deposit([5]);
    await pool.connect(tester1).withdraw([5]);

  });
});
