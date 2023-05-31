const { getNamedAccounts, ethers, deployments } = require("hardhat")

async function main() {
    let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval, subscriptionId

    deployer = (await getNamedAccounts()).deployer

    await deployments.fixture(["all"])
    raffle = await ethers.getContract("Raffle", deployer)
    raffleEntranceFee = await raffle.getEntranceFee()
    interval = await raffle.getInterval()
    subscriptionId = await raffle.getSubscriptionId()
    vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffle.address)

    console.log(await raffle.checkUpkeep([]))
}

main().catch((e) => console.log(e))
