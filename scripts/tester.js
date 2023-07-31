const { getNamedAccounts, ethers } = require("hardhat")

async function main() {
    let raffle, raffleEntranceFee, deployer

    deployer = (await getNamedAccounts()).deployer
    raffle = await ethers.getContract("Raffle", deployer)
    raffleEntranceFee = await raffle.getEntranceFee()

    const txResponse = await raffle.performUpkeep([])
    const txReceipt = await txResponse.wait(1)
    console.log(txReceipt)
}

main().catch((e) => console.log(e))
