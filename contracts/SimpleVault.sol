// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SimpleVault is Ownable {
    IERC20 public stakingToken;
    uint256 public rewardRatePerSecond;

    struct Staker {
        uint256 amount;
        uint256 startTime;
    }

    mapping(address => Staker) public stakers;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardRateChanged(uint256 oldRate, uint256 newRate);

    constructor(
        address _stakingToken,
        uint256 _rewardRatePerSecond,
        address _initialOwner
    ) Ownable(_initialOwner) {
        stakingToken = IERC20(_stakingToken);
        rewardRatePerSecond = _rewardRatePerSecond;
    }

    function setRewardRate(uint256 _newRate) external onlyOwner {
        uint256 oldRate = rewardRatePerSecond;
        rewardRatePerSecond = _newRate;
        emit RewardRateChanged(oldRate, _newRate);
    }

    function stake(uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than 0");

        Staker storage staker = stakers[msg.sender];

        if (staker.amount > 0) {
            uint256 pendingReward = calculateReward(msg.sender);
            staker.amount += pendingReward;
        }

        stakingToken.transferFrom(msg.sender, address(this), _amount);

        staker.amount += _amount;
        staker.startTime = block.timestamp;

        emit Staked(msg.sender, _amount);
    }

    function calculateReward(address _user) public view returns (uint256) {
        Staker memory staker = stakers[_user];
        if (staker.amount == 0) {
            return 0;
        }
        uint256 timeStaked = block.timestamp - staker.startTime;
        return staker.amount * rewardRatePerSecond * timeStaked;
    }

    function unstake() external {
        Staker storage staker = stakers[msg.sender];
        require(staker.amount > 0, "Nothing staked");

        uint256 reward = calculateReward(msg.sender);
        uint256 totalAmount = staker.amount + reward;

        staker.amount = 0;
        staker.startTime = 0;

        stakingToken.transfer(msg.sender, totalAmount);

        emit Unstaked(msg.sender, totalAmount, reward);
    }
}
