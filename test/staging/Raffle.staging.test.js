const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, deployments, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

if (developmentChains.includes(network.name)) {
    describe.skip
} else {
    describe("Raffle contract (Staging Tests):", function () {
        // What contract will be deploy?
        let raffle, raffleEntranceFee, deployer, subscriptionId

        beforeEach(async function () {
            deployer = (await getNamedAccounts()).deployer
            raffle = await ethers.getContract("Raffle", deployer)
            raffleEntranceFee = await raffle.getEntranceFee()
        })

        describe("fulfillRandomWords()", function () {
            it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                // enter the raffle
                const starttingTimeStamp = await raffle.getLatestTimeStamp()
                const accounts = await ethers.getSigners()

                await new Promise(async (resolve, reject) => {
                    // Setting up the listener
                    raffle.once("WinnerPicked", async () => {
                        console.log("Winner Picked, event fired!")
                        try {
                            const recentWinner = await raffle.getRecentWinner()
                            const raffleState = await raffle.getRaffleState()
                            const winnerEndingBalance = await accounts[0].getBalance()
                            const endingTimeStamp = await raffle.getLatestTimeStamp()
                            // Now lets do some comparisions
                            // the next line will must be reverted because we can't get a item of a empty array
                            await expect(raffle.getPlayer(0)).to.be.reverted
                            assert.equal(recentWinner.toString(), accounts[0].address)
                            assert.equal(raffleState.toString(), "0")
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
                    await raffle.enterRaffle({ value: raffleEntranceFee })
                    const winnerStartingBalance = await accounts[0].getBalance()
                })
            })
        })
    })
}
