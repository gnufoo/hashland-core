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

describe("HashLand", function () {

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

    // 再发一个HASHLAND的平台币
    theToken = await ERC20Token.connect(deployer).deploy();
    

    // 等待这三个合约在链上部署完成
    await theNFT.deployed();
    await pool.deployed();
    await theToken.deployed();
    await theSlotNFT.deployed();

    // 给tester1发一个等级为1的NFT卡牌
    await theNFT.mint(tester1.address, 1);
    // 给deployer账号发10000个HASHLAND平台币，后面测试用
    await theToken.mint(deployer.address, ethers.utils.parseUnits("10000", 18));

    // 下面验证一下上面的操作是正常的
    expect(await theToken.balanceOf(deployer.address)).to.equal(ethers.utils.parseUnits("10000", 18));
    expect(await theNFT.balanceOf(tester1.address)).to.equal("1");
    expect(await theNFT.ownerOf(1)).to.equal(tester1.address);

  });

  it("NFT Upgrade", async function() {

    // 再给tester1发三个1级的NFT，凑足4个，要准备测试合成升级的功能
    await theNFT.mint(tester1.address, 1);
    await theNFT.mint(tester1.address, 1);
    await theNFT.mint(tester1.address, 1);
    await theNFT.mint(tester2.address, 1);

    // tokenId分别是1,2,3,4，实际开发中，要从graph node里面来获取具体的tokenId，然后通过前端选择来传这个参数
    const tokenIds = [1, 2, 3, 4];
    expect(await theNFT.balanceOf(tester1.address)).to.equal("4");
    // 升级卡牌
    await theNFT.connect(tester1).upgrade(tokenIds);

    // 确保升级完了之后，获得一个id为5的新NFT，级别为2
    expect(await theNFT.tokenLevel(6)).to.equal(2);
    // 确保身上的4张1级卡都被销毁了 
    expect(await theNFT.balanceOf(tester1.address)).to.equal("1");
  });

  it("NFT Mining", async function(){
    // 测试挖矿以及收益
    await theNFT.connect(tester1).setApprovalForAll(pool.address, true);
    await theNFT.connect(tester2).setApprovalForAll(pool.address, true);

    // 把刚刚的2级卡牌质押进矿池合约
    // await pool.connect(tester1).deposit([6]);

    await theToken.connect(deployer).approve(pool.address, ethers.utils.parseUnits("100", 18));
    // 给矿池里面打100个平台币，并且约定10个块产完
    await pool.connect(deployer).addReward(theToken.address, ethers.utils.parseUnits("100", 18), 10);

    // 过去了20个块
    await mineBlocks(20);

    await pool.connect(tester1).deposit([6]);
    await pool.connect(tester2).deposit([5]);
    await pool.connect(tester1).withdraw([6]);
    console.log('Balance before harvest:', ethers.utils.formatUnits((await theToken.balanceOf(tester2.address)), 18));
    await pool.connect(tester2).harvestAll(tester2.address);
    console.log('Balance after harvest:', ethers.utils.formatUnits((await theToken.balanceOf(tester2.address)), 18));

    // // 看看我身上可以领的金额是多少
    // console.log('Pending Reward: ', ethers.utils.formatUnits((await pool.pendingReward(theToken.address, tester1.address)), 18));

    // // 把我身上已经质押的2级卡取出来
    // await pool.connect(tester1).withdraw([5]);

    // console.log('Balance before harvest:', ethers.utils.formatUnits((await theToken.balanceOf(tester1.address)), 18));
    // await pool.connect(tester1).harvestAll(tester1.address);
    // console.log('Balance after harvest:', ethers.utils.formatUnits((await theToken.balanceOf(tester1.address)), 18));
    // console.log('Pending Reward: ', ethers.utils.formatUnits((await pool.pendingReward(theToken.address, tester1.address)), 18));
  });

  it("Slot Increase", async function() {
    expect(await theNFT.balanceOf(tester1.address)).to.equal("1");
    expect(await theNFT.ownerOf(6)).to.equal(tester1.address);

    await theNFT.mint(tester1.address, 1);
    await theNFT.mint(tester1.address, 1);

    expect(await theNFT.balanceOf(tester1.address)).to.equal("3");
    await pool.connect(tester1).deposit([6, 7]);
    await expect(pool.connect(tester1).deposit([8])).to.be.revertedWith('ESLOT');

    await theSlotNFT.mint(tester1.address);
    await theSlotNFT.connect(tester1).setApprovalForAll(pool.address, true);

    await pool.connect(tester1).increaseSlot(1);
    await pool.connect(tester1).deposit([8]);
    // await pool.connect(tester1).deposit([7]);

    console.log(ethers.utils.formatUnits((await pool.users(tester1.address)).power, 0));
  });
});
