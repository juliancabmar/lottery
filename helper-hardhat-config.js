const { ethers } = require("hardhat")

const networkConfig = {
    31337: {
        name: "hardhat",
        subscriptionId: "2690",
        raffleEntranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15", // Not matters which was
        callbackGasLimit: "5000000",
        keepersUpdateInterval: "30",
    },
    11155111: {
        name: "sepolia",
        subscriptionId: "2690",
        gasLane: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
        keepersUpdateInterval: "30",
        raffleEntranceFee: ethers.utils.parseEther("0.01"), // 0.01 ETH
        callbackGasLimit: "500000", // 500,000 gas
        vrfCoordinatorV2: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6

module.exports = { networkConfig, developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS }
