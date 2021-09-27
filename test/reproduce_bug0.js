const { expect } = require("chai");
const { ethers } = require("hardhat");

async function mineBlocks(blockNumber) {
  while (blockNumber > 0) {
    blockNumber--;
    await hre.network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }
}

function display(bn, decimal = 18, token)
{
    console.log(ethers.utils.formatUnits(bn, decimal));
}

describe("Reproduce staking pool bug", function () {

  var theNFT, theToken, theSlotNFT;
  var deployer, tester1, tester2;
  var pool;

  it("NFT Deploy", async function () {
    const NFTContract = await ethers.getContractFactory("MiningNFT");
    const NFTPool = await ethers.getContractFactory("StakingPool");
    const ERC20Token = await ethers.getContractFactory("HashlandToken");
    const NFTSlotContract = await ethers.getContractFactory("SlotNFT");

    // 测试用例中创建三个角色，一个deployer是部署者，tester1和tester2分别是两个测试账号
    [deployer, tester1, tester2] = await ethers.getSigners();

    // 首先部署NFT合约
    theNFT = await NFTContract.connect(deployer).deploy();

    // 部署一个卡槽NFT合约
    theSlotNFT = await NFTSlotContract.connect(deployer).deploy();

    // 接着部署质押挖矿合约
    pool = await NFTPool.connect(deployer).deploy(theNFT.address, theSlotNFT.address);

    theToken = await ERC20Token.connect(deployer).deploy();    

    await theNFT.deployed();
    await pool.deployed();
    await theToken.deployed();
    await theSlotNFT.deployed();

    await theNFT.mint(tester1.address, 1);
    await theNFT.mint(tester2.address, 1);

    await theToken.mint(deployer.address, ethers.utils.parseUnits("10000", 18));

  });

  it("NFT Mining", async function(){
    
    await theNFT.connect(tester1).setApprovalForAll(pool.address, true);
    await theNFT.connect(tester2).setApprovalForAll(pool.address, true);

    await theToken.connect(deployer).approve(pool.address, ethers.utils.parseUnits("100", 18));
    await pool.connect(deployer).addReward(theToken.address, ethers.utils.parseUnits("100", 18), 10);

    await mineBlocks(20);

    await pool.connect(tester1).deposit([1]);
    await pool.connect(tester2).deposit([2]);
    await pool.connect(tester2).withdraw([2]);
    await pool.connect(tester1).harvestAll(tester1.address);

    // // 看看我身上可以领的金额是多少
    // console.log('Pending Reward: ', ethers.utils.formatUnits((await pool.pendingReward(theToken.address, tester1.address)), 18));

    // // 把我身上已经质押的2级卡取出来
    // await pool.connect(tester1).withdraw([5]);

    // console.log('Balance before harvest:', ethers.utils.formatUnits((await theToken.balanceOf(tester1.address)), 18));
    // await pool.connect(tester1).harvestAll(tester1.address);
    // console.log('Balance after harvest:', ethers.utils.formatUnits((await theToken.balanceOf(tester1.address)), 18));
    // console.log('Pending Reward: ', ethers.utils.formatUnits((await pool.pendingReward(theToken.address, tester1.address)), 18));
  });
});
