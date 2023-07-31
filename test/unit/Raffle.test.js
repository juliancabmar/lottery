const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, deployments, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

if (!developmentChains.includes(network.name)) {
    describe.skip
} else {
    // get the active network config
    const currentNetwork = networkConfig[network.config.chainId]

    describe("Raffle contract (Unit Tests):", function () {
        // What contract will be deploy?
        let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval, subscriptionId

        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer

            await deployments.fixture(["all"])
            raffle = await ethers.getContract("Raffle", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
            interval = await raffle.getInterval()
            subscriptionId = await raffle.getSubscriptionId()
            vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffle.address)
        })

        describe("constructor()", function () {
            it("initializes the raffle correctly (must be OPEN)", async function () {
                // Ideally we want to make out test with 1 assert per "it"
                const raffleState = await raffle.getRaffleState()

                // We cast the contract values to String for prevent posible comparision errors
                assert.equal(raffleState.toString(), "0")
                assert.equal(interval.toString(), currentNetwork.keepersUpdateInterval)
            })
        })

        describe("enterRaffle()", function () {
            it("reverts when you don't pay enough", async function () {
                await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__SendMoreToEnterRaffle")
            })

            it("records players when they enter", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                const playerFromContract = await raffle.getPlayer(0)
                assert.equal(deployer.toString(), playerFromContract.toString())
            })

            it("emits event on enter", async function () {
                // this is the more efficient way to test if a event was emited
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(raffle, "RaffleEnter")
            })

            it("doesen't allow entrance  when the raffle is calculating", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                // the two next calls increase the blockchain time plus "interval+1"
                // and add a new block, making checkUpKeep() true when this will called.
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                // So, now we can call performUpKeep() and change the raffleState to "CALCULATING"
                await raffle.performUpkeep([])
                // and this make enterRaffle() be reverted, making this unit test a success
                await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith("Raffle__RaffleNotOpen")
            })
        })

        describe("checkUpkeep()", function () {
            it("returns false if people haven't sent any ETH", async function () {
                // the two next calls increase the blockchain time plus "interval+1"
                // and add a new block, making timePased  to true on checkUpKeep() when this will called.
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                // Next use the "callstatic" for get the return of a public but not view function (checkUpkeep() in this case)
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert(!upkeepNeeded)
            })

            it("returns false if raffle isn't open", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                // the two next calls increase the blockchain time plus "interval+1"
                // and add a new block, making checkUpKeep() true when this will called.
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                // So, now we can call performUpKeep() and change the raffleState to "CALCULATING"
                await raffle.performUpkeep([])
                // Next use the "callstatic" for get the return of a public but not view function (checkUpkeep() in this case)
                const raffleState = await raffle.getRaffleState()
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                assert.equal(raffleState.toString(), "1")
                assert.equal(upkeepNeeded, false)
            })

            it("returns false if enough time hasn't passed", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(!upkeepNeeded)
            })

            it("returns true if enough time has passed, has players, eth, and is open", async () => {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.request({ method: "evm_mine", params: [] })
                const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                assert(upkeepNeeded)
            })
        })

        describe("performUpkeep()", function () {
            it("it only run if checkUpkeep is true", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const tx = await raffle.performUpkeep("0x")
                assert(tx)
            })

            it("reverts when checkUpkeep is false", async function () {
                await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded")
            })

            it("updates the raffle state, emits an event, and calls the vrf_coordinator", async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
                const txResponse = await raffle.performUpkeep([])
                const txReceipt = await txResponse.wait(1)
                const requestId = txReceipt.events[1].args.requestId
                const raffleState = await raffle.getRaffleState([])
                assert(requestId.toNumber() > 0)
                assert(raffleState.toString() == "1")
            })
        })

        describe("fulfillRandomWords()", function () {
            beforeEach(async function () {
                await raffle.enterRaffle({ value: raffleEntranceFee })
                await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                await network.provider.send("evm_mine", [])
            })

            it("can only be called after performUpkeep()", async function () {
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)).to.be.revertedWith("nonexistent request")
                await expect(vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)).to.be.revertedWith("nonexistent request")
            })

            // Waaaaay to big test jaja
            it("picks a winner, resets the lottery and sends money", async function () {
                const additionalsEntrants = 3
                const startingAccountIndex = 1 // because 0 is the deployer
                const accounts = await ethers.getSigners()
                for (let i = startingAccountIndex; i < startingAccountIndex + additionalsEntrants; i++) {
                    const accountConnectedRaffle = raffle.connect(accounts[i])
                    await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                    // console.log(`Account[${i}]: ${accounts[i].address}`)
                }
                // Now are 4 accounts funding the raffle (including the deployer)
                const starttingTimeStamp = await raffle.getLastTimeStamp()

                // performUpkeep (mock being Chainlink Keppers)
                // fulfillRandomWords (mock being the Chainlink VRF)
                // We will have to wait for the fulfillRandomWords to be called
                await new Promise(async (resolve, reject) => {
                    // Setting up the listener
                    raffle.once("WinnerPicked", async () => {
                        try {
                            const recentWinner = await raffle.getRecentWinner()
                            // console.log(`Recent Winner: ${recentWinner}`)
                            const raffleState = await raffle.getRaffleState()
                            const endingTimeStamp = await raffle.getLastTimeStamp()
                            const numOfPlayers = await raffle.getNumberOfPlayers()
                            const winnerEndingBalance = await accounts[1].getBalance()
                            // now the asserts
                            assert.equal(raffleState.toString(), "0")
                            assert.equal(numOfPlayers.toString(), "0")
                            assert(endingTimeStamp > starttingTimeStamp)
                            assert.equal(
                                winnerEndingBalance.toString(),
                                winnerStartingBalance.add(raffleEntranceFee.mul(additionalsEntrants).add(raffleEntranceFee).toString())
                            )
                            resolve()
                        } catch (e) {
                            reject(e)
                        }
                    })
                    // below, we will fire the event, and the listener will pick it up, and resolve
                    const tx = await raffle.performUpkeep([])
                    const txReceipt = await tx.wait(1)
                    const winnerStartingBalance = await accounts[1].getBalance()
                    await vrfCoordinatorV2Mock.fulfillRandomWords(txReceipt.events[1].args.requestId, raffle.address)
                })
            })
        })
    })
}
