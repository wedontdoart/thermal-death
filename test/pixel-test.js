const { expect } = require('chai');
const { ethers } = require('hardhat');

const PRICE_PER_PIXEL = ethers.BigNumber.from('100');

const toBytes32 = ethers.utils.formatBytes32String;
const fromBytes32 = ethers.utils.parseBytes32String;

function decHex(value, pad = 8) {
  let hex = value.toString(16);
  while (hex.length < pad) {
      hex = '0' +  hex;
  }
  return hex;
}

function encodePixel(x, y, color) {
  return `0x00000000000000000000${color}${decHex(y)}${decHex(x)}`;
}

describe('Pixel', function() {
  let PixelFactory;

  before(async function() {
    PixelFactory = await ethers.getContractFactory('Pixel');
  });

  async function deploy(w, h) {
    const pixel = await PixelFactory.deploy(w, h, 100, 1);
    await pixel.deployed();

    return pixel;
  }

  const delay = ms => new Promise(res => setTimeout(res, ms));

  describe('Contract Ownership', function() {
    it('should allow to withdraw if we change owner and withdraw with new owner', async function () {
      const [_, other] = await ethers.getSigners();
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(4, 5, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
      await pixel.buyPixel(4, 6, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
      await pixel.buyPixel(4, 7, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
      await pixel.buyPixel(4, 8, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      const pixelOther = pixel.connect(other);
      await expect(pixelOther.withdraw(other.address))
        .to.be.revertedWith('NO_ETH_TO_WITHDRAW');

      await pixel.transferOwnership(other.address);

      await expect(pixel.withdraw(pixel.address))
        .to.be.revertedWith('NO_ETH_TO_WITHDRAW');

      await pixelOther.withdraw(other.address);
    });
  });

  describe('NFT Ownership', function() {
    it('should not allow to update a pixel after transfer, while the receiver can', async function() {
      const [one, other] = await ethers.getSigners();
      const pixel = await deploy(10, 10);
      const onePixel = await pixel.connect(one);

      await onePixel.buyPixel(4, 5, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
      await pixel.transferFrom(one.address, other.address, 1);

      await expect(onePixel.updatePixel(1, 0xf000ff, toBytes32("CIAO")))
        .to.be.revertedWith('FORBIDDEN');

      const otherPixel = await pixel.connect(other);
      await otherPixel.updatePixel(1, 0xf000ff, toBytes32("CIAO"));
    });
  });

  describe('Retrieve', function() {
    it('should allow only to retrieve bought pixels', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(4, 5, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
      await pixel.buyPixel(4, 6, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
      await pixel.buyPixel(4, 7, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
      await pixel.buyPixel(4, 8, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      await expect(pixel.getPixels(0, 5))
        .to.be.revertedWith('FROM_VALUE_TOO_LOW');
      await expect(pixel.getPixels(1, 5))
        .to.be.revertedWith('TO_VALUE_TOO_HIGH');
      await pixel.getPixels(1, 4);
      await pixel.getPixels(1, 1);
    });
  });

  describe('Single buy', function() {
    it('should allow to buy a pixel', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(4, 5, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
    });

    it('should not allow to buy a pixel out of bounds', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixel(10, 0, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL}))
        .to.be.revertedWith('COORDS_OUT_OF_BOUNDS');
    });

    it('should not allow to buy a pixel with an invalid ethers amount', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixel(5, 5, 0xff00ff, toBytes32("Test"), {value: 1}))
        .to.be.revertedWith('PRICE_NOT_MATCHING');
    });

    it('should not allow to buy a pixel with an empty signature', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixel(5, 5, 0xff00ff, toBytes32(""), {value: 1}))
        .to.be.revertedWith('SIGNATURE_IS_EMPTY');
    });

    it('should not allow to buy the same pixel twice', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(5, 5, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      await expect(pixel.buyPixel(5, 5, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL}))
        .to.be.revertedWith('PIXEL_ALREADY_TAKEN');
    });

    it('should not allow to buy a pixel with an invalid color', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixel(5, 5, 0xffffff00, toBytes32("TEST"), {value: 1}))
        .to.be.revertedWith('INVALID_COLOR_FORMAT: RGB ONLY');
      await expect(pixel.buyPixel(5, 5, 0xffffff10, toBytes32("TEST"), {value: 1}))
        .to.be.revertedWith('INVALID_COLOR_FORMAT: RGB ONLY');
    });
  });

  describe('Batch buy', function() {
    it('should allow to buy multiple tokens', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixelsBatch(
        [
          encodePixel(3, 3, 'ff00ff'),
          encodePixel(2, 3, 'ff00ff'),
        ],
        [
          toBytes32("Test"),
          toBytes32("Test1"),
        ], {value: PRICE_PER_PIXEL.mul(2)});
    });

    it('should not allow to send an empty pixel array', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixelsBatch([], [toBytes32("Test")], {value: PRICE_PER_PIXEL}))
        .to.be.revertedWith('INVALID_PIXEL_DATA');
    });

    it('should not allow to send an empty signature array', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixelsBatch([encodePixel(3, 3, 'ff00ff')], [], {value: PRICE_PER_PIXEL}))
        .to.be.revertedWith('INVALID_SIGNATURE_DATA');
    });

    it('should not allow to send mismatching array sizes', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixelsBatch(
        [
          encodePixel(3, 3, 'ff00ff'),
        ],
        [
          toBytes32("Test"),
          toBytes32("Test2"),
        ], {value: PRICE_PER_PIXEL}))
        .to.be.revertedWith('ARRAY_SIZE_MISMATCH');
    });

    it('should not allow to buy pixels with an invalid ethers amount', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixelsBatch(
        [
          encodePixel(3, 3, 'ff00ff'),
          encodePixel(2, 3, 'ff00ff'),
        ],
        [
          toBytes32("Test"),
          toBytes32("Test1"),
        ], {value: 1}))
          .to.be.revertedWith('PRICE_NOT_MATCHING');
    });

    it('should not allow to buy pixels out of bounds', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixelsBatch(
        [
          encodePixel(3, 3, 'ff00ff'),
          encodePixel(100, 100, 'ff00ff'),
        ],
        [
          toBytes32("Test"),
          toBytes32("Test1"),
        ], {value: PRICE_PER_PIXEL.mul(2)}))
          .to.be.revertedWith('COORDS_OUT_OF_BOUNDS');
    });

    it('should not allow to buy pixels with an empty signature', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixelsBatch(
        [
          encodePixel(3, 3, 'ff00ff'),
          encodePixel(3, 5, 'ff00ff'),
        ],
        [
          toBytes32("Test"),
          toBytes32(""),
        ], {value: PRICE_PER_PIXEL.mul(2)}))
          .to.be.revertedWith('SIGNATURE_IS_EMPTY');
    });

    it('should not allow to buy pixels twice', async function() {
      const pixel = await deploy(10, 10);
      await expect(pixel.buyPixelsBatch(
        [
          encodePixel(3, 3, 'ff00ff'),
          encodePixel(3, 3, 'ff00ff'),
        ],
        [
          toBytes32("Test"),
          toBytes32("Test1"),
        ], {value: PRICE_PER_PIXEL.mul(2)}))
          .to.be.revertedWith('PIXEL_ALREADY_TAKEN');
    });

    it('should not allow to buy pixels twice', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(3, 3, 0x00ff00, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      await expect(pixel.buyPixelsBatch(
        [
          encodePixel(3, 3, 'ff00ff'),
          encodePixel(3, 5, 'ff00ff'),
        ],
        [
          toBytes32("Test"),
          toBytes32("Test1"),
        ], {value: PRICE_PER_PIXEL.mul(2)}))
          .to.be.revertedWith('PIXEL_ALREADY_TAKEN');
    });

    it('should not allow to buy a pixel with an invalid color', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(3, 1, 0x00ff00, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      await expect(pixel.buyPixelsBatch(
        [
          encodePixel(3, 3, 'ff00ff'),
          encodePixel(3, 5, 'ff00ff00'),
        ],
        [
          toBytes32("Test"),
          toBytes32("Test1"),
        ], {value: PRICE_PER_PIXEL.mul(2)}))
        .to.be.revertedWith('INVALID_COLOR_FORMAT: RGB ONLY');
    });
  });

  describe('Update', function() {
    it('should allow to update a pixel color', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(3, 3, 0x00ff00, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      await pixel.updatePixel(1, 0x0000ff, toBytes32("Test2"));
    });

    it('should update a pixel color and signature', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(3, 3, 0x00ff00, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      await pixel.updatePixel(1, 0xf000ff, toBytes32("Test2"));

      const px = await pixel.pixelInfo(1);
      expect(px.color).to.be.equal(0xf000ff);
      expect(fromBytes32(px.signature)).to.be.equal("Test2");
    });

    it('should not allow to update a non existent pixel', async function() {
      const pixel = await deploy(10, 10);

      expect(pixel.updatePixel(100, 0xf000ff, toBytes32("Test")))
        .to.be.revertedWith('ERC721: operator query for nonexistent token');
    });

    it('should not allow to update a not owned token', async function() {
      const [_, other] = await ethers.getSigners();

      const ownerPixel = await deploy(10, 10);
      const tx = await ownerPixel.buyPixel(3, 3, 0x00ff00, toBytes32("Test"), {value: PRICE_PER_PIXEL});
      await tx.wait();

      const otherPixel = ownerPixel.connect(other);
      expect(otherPixel.updatePixel(1, 0xf000ff, toBytes32("Test2")))
        .to.be.revertedWith('FORBIDDEN');
    });

    it('should not allow to update a pixel color with an empty signature', async function() {
      const pixel = await deploy(10, 10);
      await pixel.buyPixel(3, 3, 0x00ff00, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      expect(pixel.updatePixel(1, 0xf000ff, toBytes32("")))
        .to.be.revertedWith('SIGNATURE_IS_EMPTY');
    });
  });

  describe('Withdraw', function() {
    it('should allow to withdraw gained ethers (contract owner)', async function() {
      const [owner, other] = await ethers.getSigners();
      const pixelOwner = await deploy(10, 10);
      const pixelOther = pixelOwner.connect(other);

      await pixelOther.buyPixel(3, 3, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});

      const ownerBalance = await pixelOwner.withdrawalBalance(owner.address);
      expect(ownerBalance).to.be.equal(PRICE_PER_PIXEL);

      const otherBalance = await pixelOwner.withdrawalBalance(other.address);
      expect(otherBalance).to.be.equal(ethers.BigNumber.from(0));

      await pixelOwner.withdraw(owner.address);
      const newWithdrawalBalance = await pixelOwner.withdrawalBalance(owner.address);

      expect(newWithdrawalBalance).to.be.equal(ethers.BigNumber.from(0));
    });

    it('should allow to withdraw stored ethers', async function() {
      const [_, other] = await ethers.getSigners();
      const pixel = await deploy(10, 10);
      const pixelOther = pixel.connect(other);

      await pixelOther.buyPixel(3, 3, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL.mul(2)});

      const otherBalance = await pixelOther.withdrawalBalance(other.address);
      expect(otherBalance).to.be.equal(PRICE_PER_PIXEL);

      await pixelOther.withdraw(other.address);
      const newWithdrawalBalance = await pixelOther.withdrawalBalance(other.address);

      expect(newWithdrawalBalance).to.be.equal(ethers.BigNumber.from(0));
    });

    it('should allow to withdraw stored ethers and gain if we are the contract owner', async function() {
      const [owner] = await ethers.getSigners();
      const pixel = await deploy(10, 10);

      await pixel.buyPixel(3, 3, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL.mul(2)});

      const balance = await pixel.withdrawalBalance(owner.address);
      expect(balance).to.be.equal(PRICE_PER_PIXEL.mul(2));

      await pixel.withdraw(owner.address);
      const newWithdrawalBalance = await pixel.withdrawalBalance(owner.address);

      expect(newWithdrawalBalance).to.be.equal(ethers.BigNumber.from(0));
    });

    it('should not allow to withdraw if we do not have any stored ethers', async function() {
      const [_, other] = await ethers.getSigners();
      const pixel = await deploy(10, 10);
      const pixelOther = pixel.connect(other);

      await expect(pixelOther.withdraw(other.address))
        .to.be.revertedWith('NO_ETH_TO_WITHDRAW');
    });
  });

  describe('Thermal death', function() {
    it('should not allow to change pixel info after thermal death', async function() {
      const pixel = await deploy(2, 2);
      for (let x = 0; x < 2; x++) {
        for (let y = 0; y < 2; y++) {
          await pixel.buyPixel(x, y, 0xff00ff, toBytes32("Test"), {value: PRICE_PER_PIXEL});
        }
      }

      //Change pixel before TD
      await pixel.updatePixel(1, 0xf000ff, toBytes32("Test2"));

      await delay(2000);

      //Try to change the pixel after TD
      expect(pixel.updatePixel(1, 0xf000ff, toBytes32("Test")))
        .to.be.revertedWith('ART_IS_COMPLETE');
    });
  });
});
