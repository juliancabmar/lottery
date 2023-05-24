const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, deployments, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    // get the active network config
    const currentNetwork = networkConfig[network.config.chainId]

    describe("Raffle", function () {
        // What contract will be deploy?
        let raffle, vrfCoordinatorV2Mock

        beforeEach(async function () {
            const { deployer } = await getNamedAccounts()

            await deployments.fixture(["all"])
            raffle = await ethers.getContract("Raffle", deployer)
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        })

        describe("constructor()", function () {
            it("initializes the raffle correctly (must be OPEN)", async function () {
                // Ideally we want to make out test with 1 assert per "it"
                const raffleState = await raffle.getRaffleState()
                const interval = await raffle.getInterval()

                // We cast the contract values to String for prevent posible comparision errors
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), currentNetwork.interval)
            })
        })

        describe("enterRaffle()", function () {
            it("reverts when you don't pay enough", async function () {
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered")
            })
        })
    })
}
