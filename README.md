# Mini DeFi + DAO

The capstone project of a 90-day journey into smart contract development — a complete miniature DeFi protocol where every parameter is governed entirely by a DAO, not by any individual wallet.

This combines everything built across the previous 11 projects (ERC20, staking, governance, timelock) into one integrated system.

## Tech Stack

- Solidity 0.8.28
- Hardhat 3
- OpenZeppelin Contracts 5.x (ERC20Votes, Governor, TimelockController, Ownable)
- TypeScript + Ethers + Mocha

## Architecture

- **ProtocolToken** — ERC20 with `Permit` and `ERC20Votes`. Used both as the staking asset in the vault and as the governance/voting token.
- **SimpleVault** — A staking vault with one critical detail: `setRewardRate()` is `onlyOwner`, and **the owner is the Timelock contract, not a personal wallet**. No individual — not even the deployer — can unilaterally change protocol parameters.
- **MyTimelock** — Wraps `TimelockController`. Enforces a delay between a proposal passing and its execution.
- **MyGovernor** — Full Governor implementation (settings, simple counting, votes, quorum, timelock control) that creates and manages proposals.

## The Core Idea: Protocol Owned by Governance

```
Deployer -> deploys SimpleVault with owner = Timelock address
Deployer -> renounces admin role on Timelock
                |
From this point on, the ONLY way to change rewardRatePerSecond is:
  1. A token holder creates a proposal (propose)
  2. Token holders vote (castVote)
  3. If quorum + majority passes, the proposal is queued (queue)
  4. After the timelock delay, anyone can execute it (execute)
```

This mirrors how real production DeFi protocols hand control to their community instead of keeping an admin key.

## How to Run

Install dependencies:
```bash
npm install
```

Compile contracts:
```bash
npx hardhat compile
```

Run tests:
```bash
npx hardhat test
```

## Testing

| Test | What it proves |
|---|---|
| `vault owner is the Timelock, not a personal wallet` | Confirms ownership was correctly assigned at deployment |
| `direct call to setRewardRate from a regular wallet reverts` | Confirms no individual — including the deployer — can bypass governance |
| `DAO can change the reward rate through the full governance cycle` | End-to-end: propose -> vote -> queue -> execute, verifying the parameter actually changes only through this path |

## Technical Notes

### Renouncing Admin Control

After deployment, the deployer calls `timelock.renounceRole(DEFAULT_ADMIN_ROLE, deployer)`. Without this step, the deployer would retain emergency control over the Timelock, undermining the entire premise of decentralized governance. This is a step that's easy to forget and a common audit finding in real DAOs.

### Block-Based vs Time-Based Delays

Two different units are used across the governance cycle, and mixing them up is a common source of bugs:

- `networkHelpers.mine(n)` — advances the chain by `n` **blocks**. Used for `votingDelay` and `votingPeriod`, which are measured in blocks.
- `networkHelpers.time.increase(seconds)` — advances the chain's **timestamp**. Used for the Timelock's `minDelay`, which is measured in seconds (`block.timestamp`).

### Why Execution Takes Multiple Steps

`queue()` and `execute()` are deliberately separate calls. `queue()` schedules the operation in the Timelock and starts the delay countdown; `execute()` can only succeed once that delay has fully elapsed. This separation is what gives the community a window to react if a malicious proposal somehow passes a vote.

### Performance Note

Test execution times vary significantly between runs on resource-constrained hardware (a 4GB RAM device was used throughout this project). The first test in a run is consistently slower (~18s) because it includes the full cost of deploying four contracts and warming up the local EVM; subsequent tests reusing the same fixture run in ~1.5s. This is an artifact of the local test environment, not the contracts themselves.

## Project Series

This is the final project of a 90-day self-taught journey:
`SimpleStorage` -> `CrowdFunding` -> `Voting` -> `ERC20Token` -> `NFTCollection` -> `TokenStaking` -> `DexAMM` -> `LendingProtocol` -> `YieldVault` -> `Governance` -> **`MiniDeFiDAO`**

## Author

Wahyu — self-taught smart contract developer, built from zero JavaScript knowledge to a full DAO-governed DeFi protocol in 90 days.

License: MIT
