//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol"; 
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "hardhat/console.sol";
import "./MiningNFT.sol";

contract StakingPool is IERC721Receiver, Ownable
{
	using SafeMath for uint;
	using SafeMath for uint256;

	address public nftAsset;

	struct Staker
	{
		uint8 numSlots;
		uint8 numAvailableSlots;
		uint32 power;
		uint256 rewardDebt;
		uint256 [] stakedAssets;
	}

	struct Reward
	{
		uint256 rewardBalance;
		uint256 expiredBlock;
		uint256 startBlock;
		uint256 totalBalance;
		uint256 accRewardPerPower;
		uint256 lastRewardBlock;
	}

	uint8 private constant DEFAULT_SLOTS = 2;
	uint256 private constant ACC_REWARD_PRECISION = 1e12;

	mapping(address=>Staker) 	public users;
	mapping(uint8=>uint32) 		public powerAlloc;
	mapping(address=>Reward) 	public rewards;

	address[] public rewardList;

	uint64 public totalPower;

	constructor(address nftAddress)
	{
		nftAsset = nftAddress;
		powerAlloc[0] = 0;
		powerAlloc[1] = 100;
		powerAlloc[2] = 450;
		powerAlloc[3] = 2000;
		powerAlloc[4] = 10000;
		powerAlloc[5] = 50000;
	}

	function _nftToPower(uint256 tokenId) internal view returns(uint32)
	{
		uint8 level = MiningNFT(nftAsset).tokenLevel(tokenId);
		require(level > 0 && level < 6, "ELEVEL");
		return powerAlloc[level];
	}

	function rewardPerBlock(address token) public view returns(uint256)
	{
		Reward memory reward = rewards[token];
		if(reward.expiredBlock == reward.startBlock)
		{
			return 0;
		}
		return reward.rewardBalance.div(reward.expiredBlock.sub(reward.startBlock));
	}

	function _updateReward(address token) internal
	{
		Reward memory reward = rewards[token];
		if(block.number > reward.lastRewardBlock)
		{
			if(totalPower > 0)
			{
				uint256 blocks = block.number.sub(reward.lastRewardBlock);
				uint256 profit = blocks.mul(rewardPerBlock(token));
				reward.accRewardPerPower = reward.accRewardPerPower.add(profit.mul(ACC_REWARD_PRECISION) / totalPower);
			}
			reward.lastRewardBlock = block.number;
			rewards[token] = reward;
		}
	}

	function _updateRewards() internal
	{
		for(uint i = 0; i < rewardList.length; i ++)
		{
			_updateReward(rewardList[i]);
		}
	}

	function _updateUserDebt(address user, uint256 power, bool addOrSub) internal
	{
		for(uint i = 0; i < rewardList.length; i ++)
		{
			if(addOrSub)
			{
				users[user].rewardDebt = users[user].rewardDebt.add(
					power.mul(rewards[rewardList[i]].accRewardPerPower) / ACC_REWARD_PRECISION
				);
			}
			else
			{
				users[user].rewardDebt = users[user].rewardDebt.sub(
					power.mul(rewards[rewardList[i]].accRewardPerPower) / ACC_REWARD_PRECISION
				);
			}
		}	
	}

	function _arrayRemove(address user, uint256 tokenId) internal
	{
		for(uint i = 0; i < users[user].stakedAssets.length; i ++)
		{
			if(tokenId == users[user].stakedAssets[i])
			{
				users[user].stakedAssets[i]	= users[user].stakedAssets[users[user].stakedAssets.length - 1];
				users[user].stakedAssets.pop();
				return;
			}
		}
		require(false, "ENOTEXIST");
	}

	function pendingReward(address token, address _user) external view returns (uint256 pending) {
        Reward memory reward = rewards[token];
        Staker memory user   = users[_user];
        
        uint256 accRewardPerPower = reward.accRewardPerPower;

        if (block.number > reward.lastRewardBlock && totalPower != 0) {
            uint256 blocks = block.number.sub(reward.lastRewardBlock);
            uint256 tokenReward = blocks.mul(rewardPerBlock(token));
            accRewardPerPower = accRewardPerPower.add(tokenReward.mul(ACC_REWARD_PRECISION) / totalPower);
        }
        pending = (user.power * accRewardPerPower / ACC_REWARD_PRECISION).sub(user.rewardDebt);
    }

	function addReward(address token, uint256 amount, uint256 numBlocks) public onlyOwner
	{
		require(numBlocks > 0, "EBLOCK");
		require(amount > 0, "EAMOUNT");

		_updateReward(token);

		Reward memory reward = rewards[token];
		if(reward.expiredBlock > block.number)
		{
			reward.rewardBalance = reward.rewardBalance.mul(reward.expiredBlock.sub(block.number))
				.div(reward.expiredBlock.sub(reward.startBlock));				
		}

		reward.rewardBalance = reward.rewardBalance.add(amount);
		reward.startBlock = block.number;
		reward.expiredBlock = block.number.add(numBlocks);
		reward.totalBalance = reward.totalBalance.add(amount);
		rewards[token] = reward;
	}

	function deposit(uint256[] calldata stakingNFTs) public
	{
		// if it's a new user to deposit
		if(users[msg.sender].numSlots == 0)
		{
			users[msg.sender].numSlots = DEFAULT_SLOTS;
			users[msg.sender].numAvailableSlots = DEFAULT_SLOTS;
		}

		require(stakingNFTs.length > 0, "EARRAY");
		require(users[msg.sender].numAvailableSlots >= stakingNFTs.length, "ESLOT");

		users[msg.sender].numAvailableSlots -= uint8(stakingNFTs.length);

		_updateRewards();

		uint32 accPower = 0;
		for(uint i = 0; i < stakingNFTs.length; i ++)
		{
			uint256 tokenId = stakingNFTs[i];
			uint32 power = _nftToPower(tokenId);
			require(accPower + power >= accPower, "EOVERFLOW");
			accPower += power;
			users[msg.sender].stakedAssets.push(tokenId);
			IERC721(nftAsset).safeTransferFrom(msg.sender, address(this), tokenId);
		}

		require(users[msg.sender].power + accPower >= users[msg.sender].power, "EOVERFLOW");
		require(totalPower + accPower >= totalPower, "EOVERFLOW");

		users[msg.sender].power += accPower;
		totalPower += accPower;
		_updateUserDebt(msg.sender, accPower, true);
	}

	function withdraw(uint256[] calldata stakingNFTs) public
	{
		require(stakingNFTs.length > 0, "EARRAY");
		require(users[msg.sender].numSlots - users[msg.sender].numAvailableSlots >= uint8(stakingNFTs.length), "ESLOT");

		_updateRewards();

		uint32 accPower = 0;
		for(uint i = 0; i < stakingNFTs.length; i ++)
		{
			uint256 tokenId = stakingNFTs[i];
			uint32 power = _nftToPower(tokenId);
			require(accPower + power >= accPower, "EOVERFLOW");
			accPower += power;

			_arrayRemove(msg.sender, tokenId);
			IERC721(nftAsset).safeTransferFrom(address(this), msg.sender, tokenId);
		}

		require(users[msg.sender].power - accPower <= users[msg.sender].power, "EUNDERFLOW");
		require(totalPower - accPower <= totalPower, "EUNDERFLOW");

		users[msg.sender].power -= accPower;
		totalPower -= accPower;
		_updateUserDebt(msg.sender, accPower, false);
	}

	function onERC721Received(address, address, uint256, bytes calldata) public virtual override returns (bytes4)
    {
    	return this.onERC721Received.selector;
    }
}
