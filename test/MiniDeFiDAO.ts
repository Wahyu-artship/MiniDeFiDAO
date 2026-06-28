import { expect } from "chai";
import { network } from "hardhat";

describe("Mini DeFi + DAO", function () {
    async function deployFixture() {
        const { ethers, networkHelpers } = await network.connect();
        const [owner, voter1] = await ethers.getSigners();

        const ProtocolToken = await ethers.getContractFactory("ProtocolToken");
        const token = await ProtocolToken.deploy(1000000);

        const minDelay = 3600;
        const MyTimelock = await ethers.getContractFactory("MyTimelock");
        const timelock = await MyTimelock.deploy(minDelay, [], [], owner.address);

        const MyGovernor = await ethers.getContractFactory("MyGovernor");
        const governor = await MyGovernor.deploy(
            await token.getAddress(),
            await timelock.getAddress()
        );

        const proposerRole = await timelock.PROPOSER_ROLE();
        const executorRole = await timelock.EXECUTOR_ROLE();
        const adminRole = await timelock.DEFAULT_ADMIN_ROLE();

        await timelock.grantRole(proposerRole, await governor.getAddress());
        await timelock.grantRole(executorRole, ethers.ZeroAddress);

        // SimpleVault dibuat dengan owner = Timelock, BUKAN wallet pribadi
        const initialRewardRate = 1;
        const SimpleVault = await ethers.getContractFactory("SimpleVault");
        const vault = await SimpleVault.deploy(
            await token.getAddress(),
            initialRewardRate,
            await timelock.getAddress()
        );

        // Owner asli (deployer) lepas akses admin Timelock setelah setup,
        // supaya benar-benar cuma governance yang punya kendali
        await timelock.renounceRole(adminRole, owner.address);

        await token.transfer(voter1.address, ethers.parseUnits("100000", 18));
        await token.connect(voter1).delegate(voter1.address);
        await token.delegate(owner.address);

        return { governor, token, timelock, vault, owner, voter1, ethers, networkHelpers };
    }

    it("vault owner is the Timelock, not a personal wallet", async function () {
        const { vault, timelock } = await deployFixture();

        expect(await vault.owner()).to.equal(await timelock.getAddress());
    });

    it("direct call to setRewardRate from a regular wallet reverts", async function () {
        const { vault, owner } = await deployFixture();

        await expect(
            vault.connect(owner).setRewardRate(999)
        ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    });

    it("DAO can change the reward rate through the full governance cycle", async function () {
        const { governor, vault, timelock, voter1, ethers, networkHelpers } = await deployFixture();

        const newRate = 5;
        const targets = [await vault.getAddress()];
        const values = [0];
        const calldatas = [
            vault.interface.encodeFunctionData("setRewardRate", [newRate])
        ];
        const description = "Proposal: Increase reward rate to 5";
        const descriptionHash = ethers.id(description);

        // 1. Propose
        await governor.connect(voter1).propose(targets, values, calldatas, description);
        const proposalId = await governor.hashProposal(targets, values, calldatas, descriptionHash);

        // 2. Wait past voting delay
        await networkHelpers.mine(2);

        // 3. Vote
        await governor.connect(voter1).castVote(proposalId, 1);

        // 4. Wait past voting period (50 blocks)
        await networkHelpers.mine(51);

        // 5. Queue (masuk antrian Timelock)
        await governor.queue(targets, values, calldatas, descriptionHash);

        // 6. Wait past timelock delay (3600 seconds)
        await networkHelpers.time.increase(3601);

        // 7. Execute
        await governor.execute(targets, values, calldatas, descriptionHash);

        // Verifikasi: reward rate vault beneran berubah
        expect(await vault.rewardRatePerSecond()).to.equal(newRate);
    });
});