const hre = require('hardhat');

async function main() {
  const PixelFactory = await hre.ethers.getContractFactory('Pixel');
  const pixel = await PixelFactory.deploy("160", "110", "100000000000000000", 60 * 60 * 24 * 14);

  await pixel.deployed();

  console.log("Contract deployed to:", greeter.address);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
